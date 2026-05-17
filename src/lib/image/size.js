// gpt-image-2 accepts auto or custom WxH values:
// width/height must be multiples of 16, aspect ratio must be between 1:3 and 3:1,
// and the maximum supported 4K resolution is 3840x2160.

export const MIN_IMAGE_SIDE = 16
export const MAX_IMAGE_SIDE = 3840
export const MIN_IMAGE_PIXELS = 655_360
export const MAX_IMAGE_PIXELS = 3840 * 2160
export const MAX_IMAGE_ASPECT_RATIO = 3
export const IMAGE_SIZE_STEP = 16

export const ASPECT_RATIOS = [
  { id: '1:1', label: '1:1', w: 1, h: 1 },
  { id: '3:2', label: '3:2', w: 3, h: 2 },
  { id: '2:3', label: '2:3', w: 2, h: 3 },
  { id: '4:3', label: '4:3', w: 4, h: 3 },
  { id: '3:4', label: '3:4', w: 3, h: 4 },
  { id: '16:9', label: '16:9', w: 16, h: 9 },
  { id: '9:16', label: '9:16', w: 9, h: 16 }
]

export const TARGET_PIXELS = {
  '1K': 1024 * 1024,
  '2K': 2048 * 2048,
  '4K': 3840 * 2160
}

export const POPULAR_IMAGE_SIZES = [
  { value: '1024x1024', label: '1024 × 1024', description: '方图 1K' },
  { value: '2048x2048', label: '2048 × 2048', description: '方图 4 MP' },
  { value: '3840x2160', label: '3840 × 2160', description: '横向 4K' },
  { value: '2160x3840', label: '2160 × 3840', description: '竖向 4K' }
]

export function snapDownToMultipleOf16(n) {
  return Math.max(IMAGE_SIZE_STEP, Math.floor(Number(n || 0) / IMAGE_SIZE_STEP) * IMAGE_SIZE_STEP)
}

export function snapToMultipleOf16(n) {
  return Math.max(IMAGE_SIZE_STEP, Math.round(Number(n || 0) / IMAGE_SIZE_STEP) * IMAGE_SIZE_STEP)
}

export function clampImageSide(n) {
  return Math.min(MAX_IMAGE_SIDE, Math.max(MIN_IMAGE_SIDE, snapDownToMultipleOf16(n)))
}

export function computePresetSize(targetKey, aspectId) {
  if (targetKey === 'auto') return { value: 'auto', w: null, h: null, label: 'Auto' }
  const aspect = ASPECT_RATIOS.find((a) => a.id === aspectId) || ASPECT_RATIOS[0]
  const target = TARGET_PIXELS[targetKey] || TARGET_PIXELS['1K']
  const area = Math.min(MAX_IMAGE_PIXELS, Math.max(MIN_IMAGE_PIXELS, target))
  const k = Math.sqrt(area / (aspect.w * aspect.h))
  let w = clampImageSide(aspect.w * k)
  let h = clampImageSide(aspect.h * k)

  while (w * h > MAX_IMAGE_PIXELS && (w > MIN_IMAGE_SIDE || h > MIN_IMAGE_SIDE)) {
    if (w >= h && w > MIN_IMAGE_SIDE) w -= IMAGE_SIZE_STEP
    else if (h > MIN_IMAGE_SIDE) h -= IMAGE_SIZE_STEP
    else break
  }

  return { value: `${w}x${h}`, w, h, label: `${w} × ${h}` }
}

export function parseSize(value) {
  if (!value || value === 'auto') return { mode: 'auto' }
  const match = String(value).match(/^(\d+)x(\d+)$/i)
  if (!match) return { mode: 'invalid' }
  return { mode: 'fixed', w: Number(match[1]), h: Number(match[2]) }
}

export function isValidImageSize(value) {
  const parsed = parseSize(value)
  if (parsed.mode === 'auto') return true
  if (parsed.mode !== 'fixed') return false
  const { w, h } = parsed
  const pixels = w * h
  const aspectRatio = Math.max(w / h, h / w)
  return (
    w >= MIN_IMAGE_SIDE &&
    h >= MIN_IMAGE_SIDE &&
    w <= MAX_IMAGE_SIDE &&
    h <= MAX_IMAGE_SIDE &&
    w % IMAGE_SIZE_STEP === 0 &&
    h % IMAGE_SIZE_STEP === 0 &&
    aspectRatio <= MAX_IMAGE_ASPECT_RATIO &&
    pixels >= MIN_IMAGE_PIXELS &&
    pixels <= MAX_IMAGE_PIXELS
  )
}

export function normalizeSize(value) {
  if (value === 'auto') return 'auto'
  const parsed = parseSize(value)
  if (parsed.mode !== 'fixed') return '1024x1024'
  const w = clampImageSide(parsed.w)
  const h = clampImageSide(parsed.h)
  if (isValidImageSize(`${w}x${h}`)) return `${w}x${h}`
  return '1024x1024'
}

export function describeSize(value) {
  const parsed = parseSize(value)
  if (parsed.mode === 'auto') return 'Auto'
  if (parsed.mode !== 'fixed') return '1024 × 1024'
  return `${parsed.w} × ${parsed.h}`
}

export function detectPreset(value) {
  const parsed = parseSize(value)
  if (parsed.mode === 'auto') return { target: 'auto', aspect: '1:1' }
  if (parsed.mode !== 'fixed') return { target: '1K', aspect: '1:1' }
  const pixels = parsed.w * parsed.h
  const ratio = parsed.w / parsed.h
  let bestTarget = '1K'
  let targetDiff = Infinity
  for (const [key, target] of Object.entries(TARGET_PIXELS)) {
    const diff = Math.abs(target - pixels) / target
    if (diff < targetDiff) {
      bestTarget = key
      targetDiff = diff
    }
  }
  let bestAspect = ASPECT_RATIOS[0]
  let aspectDiff = Infinity
  for (const aspect of ASPECT_RATIOS) {
    const diff = Math.abs(aspect.w / aspect.h - ratio)
    if (diff < aspectDiff) {
      bestAspect = aspect
      aspectDiff = diff
    }
  }
  return { target: bestTarget, aspect: bestAspect.id }
}

export const QUALITY_OPTIONS = [
  { value: 'low', label: '低', description: '快速预览' },
  { value: 'medium', label: '中', description: '平衡' },
  { value: 'high', label: '高', description: '最佳' }
]

export const FORMAT_OPTIONS = [
  { value: 'png', label: 'PNG' },
  { value: 'jpeg', label: 'JPEG' },
  { value: 'webp', label: 'WebP' }
]

export const MODERATION_OPTIONS = [
  { value: 'auto', label: '默认' },
  { value: 'low', label: '宽松' }
]
