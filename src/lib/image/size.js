// Smart size selector matching gpt_image_playground's behavior.
// Supports "auto", presets bucketed by 1K/2K/4K target + common aspect ratios,
// and custom WxH that snaps down to nearest multiple of 16.

export const ASPECT_RATIOS = [
  { id: '1:1', label: '1:1', w: 1, h: 1 },
  { id: '3:2', label: '3:2', w: 3, h: 2 },
  { id: '2:3', label: '2:3', w: 2, h: 3 },
  { id: '4:3', label: '4:3', w: 4, h: 3 },
  { id: '3:4', label: '3:4', w: 3, h: 4 },
  { id: '16:9', label: '16:9', w: 16, h: 9 },
  { id: '9:16', label: '9:16', w: 9, h: 16 },
  { id: '21:9', label: '21:9', w: 21, h: 9 }
]

export const TARGET_PIXELS = {
  '1K': 1024 * 1024,
  '2K': 2048 * 2048,
  '4K': 4096 * 4096
}

export function snapDownToMultipleOf16(n) {
  return Math.max(16, Math.floor(n / 16) * 16)
}

export function snapToMultipleOf16(n) {
  return Math.max(16, Math.round(n / 16) * 16)
}

export function computePresetSize(targetKey, aspectId) {
  if (targetKey === 'auto') return { value: 'auto', w: null, h: null, label: 'Auto' }
  const aspect = ASPECT_RATIOS.find((a) => a.id === aspectId) || ASPECT_RATIOS[0]
  const target = TARGET_PIXELS[targetKey] || TARGET_PIXELS['1K']
  // Pick w/h preserving aspect ratio so that w * h ≈ target, then snap.
  const k = Math.sqrt(target / (aspect.w * aspect.h))
  const rawW = aspect.w * k
  const rawH = aspect.h * k
  const w = snapDownToMultipleOf16(rawW)
  const h = snapDownToMultipleOf16(rawH)
  return { value: `${w}x${h}`, w, h, label: `${w} × ${h}` }
}

export function parseSize(value) {
  if (!value || value === 'auto') return { mode: 'auto' }
  const match = String(value).match(/^(\d+)x(\d+)$/i)
  if (!match) return { mode: 'auto' }
  return { mode: 'fixed', w: Number(match[1]), h: Number(match[2]) }
}

export function describeSize(value) {
  const p = parseSize(value)
  if (p.mode === 'auto') return 'Auto'
  return `${p.w} × ${p.h}`
}

// Try to detect which target+aspect a fixed WxH belongs to, for preset reverse-lookup.
export function detectPreset(value) {
  const p = parseSize(value)
  if (p.mode === 'auto') return { target: 'auto', aspect: '1:1' }
  const pixels = p.w * p.h
  const aspectRatio = p.w / p.h
  let bestTarget = '1K'
  let bestDiff = Infinity
  for (const key of Object.keys(TARGET_PIXELS)) {
    const diff = Math.abs(TARGET_PIXELS[key] - pixels) / TARGET_PIXELS[key]
    if (diff < bestDiff) {
      bestDiff = diff
      bestTarget = key
    }
  }
  let bestAspect = ASPECT_RATIOS[0]
  let aspectDiff = Infinity
  for (const a of ASPECT_RATIOS) {
    const ar = a.w / a.h
    const diff = Math.abs(ar - aspectRatio)
    if (diff < aspectDiff) {
      aspectDiff = diff
      bestAspect = a
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
