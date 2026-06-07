# 图片生成与编辑 API 对接文档

> 最后更新：2026-06-07。本文档描述当前 Nest 后端已实现接口，历史参考实现片段仅作为背景。

前端代码位于 `src/app/image/` 与相关组件中，通过 `fetch('/api/images/...')` 调用后端。Next.js 的 `next.config.mjs` 将 `/api/*` 反向代理到 `NEXT_PUBLIC_API_BASE_URL`（默认 `http://127.0.0.1:3001`）。

当前后端已实现以下端点：

- `POST /api/images/generations`：文本生图
- `POST /api/images/edits`：参考图编辑
- `POST /api/images/uploads`：multipart 上传参考图
- `GET /api/images/tasks`：当前用户图片任务历史
- `GET /api/images/usage`：当前用户图片存储统计
- `GET /api/images/:id`：当前用户图片元数据
- `GET /api/images/:id/raw`：当前用户私有图片内容

所有端点均要求普通用户登录会话（cookie）。生图和编辑会在调用上游模型前完成积分扣减、模型可用性校验、审计日志写入等公共流程，与 `/api/chat/completions` 保持一致。

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
{ "message": "points_insufficient" }
```

常见错误：`unauthorized` / `points_insufficient` / `model_disabled` / `invalid_size` / `invalid_n` / `upstream_error`。

---

## 2. POST /api/images/edits

参考图编辑接口。当前支持三种参考图输入：

- multipart/form-data 字段 `images`，最多 16 个文件，单图 25 MB。
- JSON `images` data URL 数组，用于兼容旧前端。
- `imageIds`，引用已经通过 `POST /api/images/uploads` 上传并归属于当前用户的图片。

JSON 请求体与 `generations` 几乎一致，多一个 `images` 或 `imageIds`：

```json
{
  "conversationId": "string | null",
  "model":  "string",
  "prompt": "string",
  "images": [
    "data:image/png;base64,...",
    "data:image/jpeg;base64,..."
  ],
  "imageIds": ["img_xxx"],
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

## 3. POST /api/images/uploads

上传参考图到服务端对象存储。请求必须为 multipart/form-data：

| 字段 | 说明 |
|------|------|
| `file` | 图片文件，单图最大 25 MB |

成功后返回图片元数据，包含可供后续编辑接口使用的 `imageId`/`id`、hash、contentType、bytes 和短期私有访问地址等字段。后端会按 SHA-256 做物理去重，但用户侧使用统计仍按当前用户独立记录。

---

## 4. GET /api/images/tasks

读取当前登录用户的图片任务历史：

```http
GET /api/images/tasks?limit=30
```

`limit` 默认为 30。响应包含生成/编辑任务、输入图、输出图、状态、模型、提示词、参数和时间信息。

---

## 5. GET /api/images/usage

读取当前用户图片存储统计。当前 `StorageUsage` 主要用于统计与后续配额预留，生产侧仍可以通过环境变量控制上传大小和 GC 行为。

---

## 6. GET /api/images/:id 与 /raw

- `GET /api/images/:id`：返回当前用户可访问图片的元数据。
- `GET /api/images/:id/raw`：后端鉴权后代理返回图片二进制，响应头包含 `Content-Type` 与 `Cache-Control: private, max-age=1800`。

---

## 7. 与上游 OpenAI gpt-image-2 的映射

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

## 8. 历史 Node.js 参考实现片段（Express + 上游 OpenAI）

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

  const estimated = estimatePoints({ n, size, quality })
  if (req.user.pointsBalance < estimated)
    return res.status(402).json({ message: 'points_insufficient' })

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

## 9. 计费说明

Chatty 当前使用本地积分定价，核心环境变量：

```text
POINT_PRICE_IMAGE_GENERATION=20
POINT_PRICE_IMAGE_EDIT=30
```

模型返回的 `usage` 和上游请求信息会进入审计记录，但用户余额扣减以本地积分规则为准。

---

## 10. 流式 vs 一次性返回

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
