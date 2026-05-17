# 图片生成与编辑 API 对接文档

本文档描述了重构后的前端对后端的需求。前端代码位于 `src/app/image/` 与 `src/lib/image/`，通过 `fetch('/api/images/...')` 调用后端。Next.js 的 `next.config.mjs` 将 `/api/*` 反向代理到 `NEXT_PUBLIC_API_BASE_URL`（默认 `http://127.0.0.1:3001`）。

后端只需新增 / 扩展两个端点：

- `POST /api/images/generations` —— 文本生图（扩展原有端点）
- `POST /api/images/edits` —— 参考图编辑（新增）

两个端点均要求登录会话（cookie），并在调用上游模型前完成 Token 余额扣减、模型可用性校验、审计日志写入等公共流程，与 `/api/chat/completions` 保持一致。

---

## 1. POST /api/images/generations

### 请求体

```json
{
  "conversationId": "string | null",   // 可选；若需要把生成记录归入某个会话
  "model":         "string",            // 必填，sub2apiModel
  "prompt":        "string",            // 必填，长度 1–4000
  "size":          "string",            // "auto" | "WxH"（image2: 16 的倍数，比例 1:3 到 3:1，最高 3840x2160）
  "quality":       "low|medium|high",   // 默认 medium
  "output_format": "png|jpeg|webp",     // 默认 png
  "output_compression": 0-100,          // 仅当 output_format=jpeg|webp 时生效
  "moderation":    "auto|low",          // 默认 auto
  "n":             1-8                  // 默认 1
}
```

### 校验规则

| 字段 | 规则 | 错误码 |
|------|------|--------|
| `prompt` | 非空字符串、≤4000 字符 | `invalid_prompt` |
| `size`   | `auto` 或 `^\d+x\d+$`；image2 要求 w/h 为 16 的倍数，比例 1:3 到 3:1，最高 3840x2160 | `invalid_size` |
| `quality` | 枚举 | `invalid_quality` |
| `output_format` | 枚举 | `invalid_format` |
| `output_compression` | 整数 0–100 | `invalid_compression` |
| `n` | 整数 1–8 | `invalid_n` |
| `model` | 存在、可用、为图片生成类型 | `model_disabled` / `model_not_found` |

### 响应体（成功 200）

```json
{
  "requestId": "req_xxxx",
  "model": "gpt-image-2",
  "images": [
    "data:image/png;base64,iVBORw...",
    "https://signed-url..."
  ],
  "content": "可选的描述文本（如有）",
  "usage": {
    "input_tokens": 12,
    "output_tokens": 0,
    "image_tokens": 1024
  },
  "conversationId": "conv_xxxx"
}
```

要求：
- `images` 数组长度等于请求的 `n`。
- 每个元素可以是 `data:` URL 或 HTTPS URL；前端会自行 `fetch` 拿到 Blob 写入 IndexedDB。
- 如果上游返回的是签名 URL，请确保过期时间 ≥ 5 分钟，方便前端落盘。

### 错误响应

沿用项目现有错误格式：

```json
{ "message": "token_insufficient" }
```

常见错误：`unauthorized` / `token_insufficient` / `model_disabled` / `invalid_size` / `invalid_n` / `upstream_error`。

---

## 2. POST /api/images/edits

参考图编辑接口。请求体与 `generations` 几乎一致，多一个 `images` 数组：

```json
{
  "conversationId": "string | null",
  "model":  "string",
  "prompt": "string",
  "images": [
    "data:image/png;base64,...",
    "data:image/jpeg;base64,..."
  ],
  "size":   "string",
  "quality": "low|medium|high",
  "output_format": "png|jpeg|webp",
  "output_compression": 0-100,
  "moderation": "auto|low",
  "n": 1-8
}
```

### 额外校验

| 字段 | 规则 | 错误码 |
|------|------|--------|
| `images` | 1–16 个，每个为合法 data URL；单图 ≤ 25 MB；总和 ≤ 100 MB | `too_many_reference_images` / `reference_image_too_large` |

响应结构与 `generations` 完全一致。

---

## 3. 与上游 OpenAI gpt-image-2 的映射

如果你后端直接对接 OpenAI 的 Images API：

| 前端参数 | OpenAI API 字段 |
|---------|---------------|
| `model` | `model`（如 `gpt-image-2`） |
| `prompt` | `prompt` |
| `size` | `size`（`auto` 直接透传；image2 可传合法自定义尺寸，如 `3840x2160` / `2160x3840`） |
| `quality` | `quality` |
| `output_format` | `output_format` |
| `output_compression` | `output_compression` |
| `moderation` | `moderation` |
| `n` | `n` |
| `images`（edits 端点） | `image[]`（multipart form 多图字段） |

注意：OpenAI `/v1/images/edits` 要求 multipart/form-data，需要把前端传过来的 base64 dataURL 反编码为 Buffer / File 再 append 到 form。

---

## 4. Node.js 参考实现片段（Express + 上游 OpenAI）

```js
import express from 'express'
import multer from 'multer'
import { Readable } from 'node:stream'
import { FormData, fetch } from 'undici'

const router = express.Router()

router.post('/api/images/generations', requireAuth, async (req, res) => {
  const {
    model, prompt, size, quality, output_format,
    output_compression, moderation, n, conversationId
  } = req.body

  const validation = validateImageRequest(req.body)
  if (!validation.ok) return res.status(400).json({ message: validation.code })

  const modelRow = await db.findModel({ sub2apiModel: model, enabled: true, kind: 'image' })
  if (!modelRow) return res.status(400).json({ message: 'model_disabled' })

  const estimated = estimateTokens({ n, size, quality })
  if (req.user.tokenBalance < estimated)
    return res.status(402).json({ message: 'token_insufficient' })

  try {
    const upstream = await fetch(`${modelRow.gateway}/v1/images/generations`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${modelRow.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: modelRow.upstreamModel,
        prompt,
        size,
        quality,
        output_format,
        output_compression: output_format === 'png' ? undefined : output_compression,
        moderation,
        n
      })
    })
    const data = await upstream.json()
    if (!upstream.ok)
      return res.status(502).json({ message: 'upstream_error', detail: data })

    const images = (data.data || []).map((d) => d.b64_json
      ? `data:image/${output_format};base64,${d.b64_json}`
      : d.url
    )

    const usage = data.usage || {}
    await db.deductTokens(req.user.id, computeCost(usage, modelRow))
    await db.recordLlmRequest({ /* ... */ })

    res.json({
      requestId: data.id || crypto.randomUUID(),
      model,
      images,
      usage,
      conversationId
    })
  } catch (err) {
    console.error('[images/generations] failed', err)
    res.status(500).json({ message: 'upstream_error', detail: String(err) })
  }
})

// 编辑端点
const upload = multer({ limits: { fileSize: 25 * 1024 * 1024, files: 16 } })

router.post('/api/images/edits', requireAuth, async (req, res) => {
  const { model, prompt, images = [], size, quality, output_format, output_compression, moderation, n } = req.body
  if (!Array.isArray(images) || images.length === 0 || images.length > 16)
    return res.status(400).json({ message: 'too_many_reference_images' })

  const modelRow = await db.findModel({ sub2apiModel: model, enabled: true, kind: 'image' })
  if (!modelRow) return res.status(400).json({ message: 'model_disabled' })

  const form = new FormData()
  form.set('model', modelRow.upstreamModel)
  form.set('prompt', prompt)
  if (size) form.set('size', size)
  if (quality) form.set('quality', quality)
  if (output_format) form.set('output_format', output_format)
  if (output_compression != null && output_format !== 'png')
    form.set('output_compression', String(output_compression))
  if (moderation) form.set('moderation', moderation)
  if (n) form.set('n', String(n))

  for (const [i, dataUrl] of images.entries()) {
    const blob = dataUrlToBlob(dataUrl)
    form.append('image[]', blob, `ref_${i}.png`)
  }

  const upstream = await fetch(`${modelRow.gateway}/v1/images/edits`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${modelRow.apiKey}` },
    body: form
  })
  const data = await upstream.json()
  if (!upstream.ok) return res.status(502).json({ message: 'upstream_error', detail: data })

  const imgs = (data.data || []).map((d) => d.b64_json
    ? `data:image/${output_format || 'png'};base64,${d.b64_json}`
    : d.url
  )
  res.json({
    requestId: data.id || crypto.randomUUID(),
    model,
    images: imgs,
    usage: data.usage || {}
  })
})

function dataUrlToBlob(dataUrl) {
  const m = /^data:(.+?);base64,(.+)$/.exec(dataUrl)
  if (!m) throw new Error('invalid_image')
  return new Blob([Buffer.from(m[2], 'base64')], { type: m[1] })
}

export default router
```

---

## 5. 计费建议

OpenAI gpt-image-2 按 token 计费，三档定价示例（请以最新官方为准）：

| Quality | 单图费用（参考） |
|---------|----------------|
| low     | ~$0.011 |
| medium  | ~$0.042 |
| high    | ~$0.167 |

后端可以在响应里附带 `usage.image_tokens`，前端目前不直接展示，但会落到 `tasks` 详情记录中。

---

## 6. 流式 vs 一次性返回

当前接口是一次性返回（同步生成）。如果未来要支持渐进式渲染，可以扩展为 SSE：

```
event: image.progress
data: {"percent": 32}

event: image.partial
data: {"images": ["..."]}

event: image.done
data: {"requestId": "..."}
```

前端的 `generateImageRequest` 目前是 `await res.json()`，要切到 SSE 需要改成 ReadableStream 解析。先按一次性返回实现即可。
