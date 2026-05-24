// Rule-based badge detection for model cards. Pure function so it can be reused
// in chat / image workspaces and unit-tested without React.

const RULES = [
  {
    label: '视觉',
    re: /vision|多模态|vl|image|视觉/i,
    className: 'border-celadon-600/30 bg-celadon-50 text-celadon-700'
  },
  {
    label: '快速',
    re: /turbo|fast|flash|快|mini|nano|haiku|tiny/i,
    className: 'border-celadon-600/30 bg-celadon-50 text-celadon-700'
  },
  {
    label: '推理',
    re: /o1\b|opus|max\b|pro\b|ultra|sonnet|reason|thinking|推理/i,
    className: 'border-gold-500/30 bg-gold-500/10 text-gold-600'
  },
  {
    label: '免费',
    re: /free|免费/i,
    className: 'border-ink-700/10 bg-rice-100 text-ink-600'
  }
]

export function detectModelBadges(model) {
  const text = `${model?.id || ''} ${model?.name || ''} ${model?.remark || ''}`
  return RULES.filter((r) => r.re.test(text)).map(({ re, ...rest }) => rest)
}

export function isImageGenerationModel(model) {
  const text = `${model?.id || ''} ${model?.name || ''} ${model?.remark || ''}`.toLowerCase()
  return [
    'image',
    'image2',
    'images',
    'gpt-image',
    'dall-e',
    'dalle',
    'imagen',
    'flux',
    'stable-diffusion',
    'stable diffusion',
    'midjourney',
    'cogview',
    'seedream',
    'jimeng',
    'qwen-image',
    'wanx',
    '文生图',
    '生图',
    '绘图',
    '图片'
  ].some((keyword) => text.includes(keyword))
}

export function getGreeting(date = new Date()) {
  const h = date.getHours()
  if (h < 5) return '夜深了'
  if (h < 11) return '早上好'
  if (h < 14) return '中午好'
  if (h < 18) return '下午好'
  return '晚上好'
}
