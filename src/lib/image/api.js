// Wrapper around backend image endpoints.
// /api/images/generations  – text-to-image
// /api/images/edits        – reference-image edit (multi-image input)
//
// The backend is expected to accept the OpenAI-style parameter names and return:
//   {
//     images: [<dataUrlOrHttpUrl>, ...],
//     content?: string,
//     requestId?: string,
//     usage?: { ... }
//   }
//
// See docs/backend-image-api.md for full spec.

function readCsrfCookie() {
  if (typeof document === 'undefined') return ''
  const match = document.cookie.match(/(?:^|;\s*)chatty_csrf=([^;]+)/)
  return match ? decodeURIComponent(match[1]) : ''
}

async function readJson(res) {
  const text = await res.text().catch(() => '')
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

function apiUrl(path) {
  // Keep image calls on the same origin as the app so they use the Next.js
  // /api rewrite, cookies, and CSRF token exactly like the rest of the frontend.
  //
  // In local dev, Next's rewrite proxy can reset large image JSON responses.
  // When the dev script exposes the backend URL, call that backend port directly
  // but preserve the browser hostname so host-only cookies still apply.
  const direct = localDevApiUrl(path)
  if (direct) return direct
  return path
}

function localDevApiUrl(path) {
  if (typeof window === 'undefined') return ''
  const rawBase = process.env.NEXT_PUBLIC_API_BASE_URL
  if (!rawBase) return ''
  let base
  try {
    base = new URL(rawBase)
  } catch {
    return ''
  }
  const pageHost = window.location.hostname
  const localHosts = new Set(['localhost', '127.0.0.1', '::1'])
  if (!localHosts.has(pageHost) || !localHosts.has(base.hostname)) return ''
  const cleanPath = path.startsWith('/api/') ? path : `/api${path.startsWith('/') ? path : `/${path}`}`
  return `${base.protocol}//${pageHost}:${base.port}${cleanPath}`
}

async function fetchImageApi(path, init) {
  try {
    return await fetch(apiUrl(path), init)
  } catch (err) {
    if (err?.name === 'AbortError' || err?.name === 'TimeoutError') {
      throw new Error('图片接口响应超时，请稍后重试')
    }
    throw new Error('图片接口连接失败，请确认前后端服务已启动，并从同一个地址访问页面')
  }
}

function parseError(status, data) {
  const message = data?.message || data?.error || ''
  const detail = data?.detail || data?.details || ''
  if (status === 401 || message === 'unauthorized') return '请先登录'
  if (message === 'token_insufficient') return '算力点不足'
  if (message === 'model_disabled') return '当前模型暂不可用'
  if (message === 'image_generation_not_enabled') return '当前网关分组未开启图片生成'
  if (message === 'upstream_error') return detail || '上游图片服务返回错误'
  if (message === 'invalid_size') return '尺寸不支持：image2 要求宽高为 16 的倍数、比例 1:3 到 3:1、最高 3840×2160'
  if (message === 'invalid_n') return '生成数量不支持：单次最多生成 4 张'
  if (message === 'image_count_too_large_for_size') return '当前尺寸较大，单次生成数量需要调低'
  if (message === 'too_many_reference_images') return '参考图数量超过限制（最多 16 张）'
  if (typeof detail === 'string' && detail) return detail
  if (typeof message === 'string' && message) return message
  return `请求失败 (HTTP ${status})`
}

export async function generateImageRequest(payload, { signal } = {}) {
  const csrf = readCsrfCookie()
  const res = await fetchImageApi('/api/images/generations', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(csrf ? { 'X-CSRF-Token': csrf } : {}) },
    body: JSON.stringify(payload),
    signal
  })
  const data = await readJson(res)
  if (!res.ok) throw new Error(parseError(res.status, data))
  return data
}

// `payload.refBlobs`: optional array of { blob: Blob, ext?: string } sent as multipart files.
// If absent, sends a JSON body (legacy base64 path) for backward compatibility.
export async function editImageRequest(payload, { signal } = {}) {
  const csrf = readCsrfCookie()
  const baseHeaders = csrf ? { 'X-CSRF-Token': csrf } : {}
  const refBlobs = Array.isArray(payload?.refBlobs) ? payload.refBlobs : null
  let init
  if (refBlobs && refBlobs.length > 0) {
    const form = new FormData()
    const { refBlobs: _omit, ...rest } = payload
    for (const [key, value] of Object.entries(rest)) {
      if (value === undefined || value === null) continue
      form.append(key, typeof value === 'string' ? value : String(value))
    }
    refBlobs.forEach(({ blob, ext = 'png' }, i) => {
      form.append('images', blob, `ref_${i}.${ext}`)
    })
    init = { method: 'POST', credentials: 'include', headers: baseHeaders, body: form, signal }
  } else {
    init = {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...baseHeaders },
      body: JSON.stringify(payload),
      signal
    }
  }
  const res = await fetchImageApi('/api/images/edits', init)
  const data = await readJson(res)
  if (!res.ok) throw new Error(parseError(res.status, data))
  return data
}

// Convert an arbitrary image URL/dataURL into a Blob (handles both data: and http(s):).
export async function urlToBlob(url) {
  if (!url) throw new Error('empty url')
  const res = await fetch(url)
  if (!res.ok) throw new Error(`fetch failed: ${res.status}`)
  return res.blob()
}

export function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export async function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

export async function getImageDimensions(blobOrUrl) {
  return new Promise((resolve, reject) => {
    const url = typeof blobOrUrl === 'string' ? blobOrUrl : URL.createObjectURL(blobOrUrl)
    const img = new Image()
    img.onload = () => {
      const dim = { width: img.naturalWidth, height: img.naturalHeight }
      if (typeof blobOrUrl !== 'string') URL.revokeObjectURL(url)
      resolve(dim)
    }
    img.onerror = (e) => {
      if (typeof blobOrUrl !== 'string') URL.revokeObjectURL(url)
      reject(e)
    }
    img.src = url
  })
}
