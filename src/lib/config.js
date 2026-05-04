const providerMeta = {
  openai: {
    name: 'OpenAI',
    logo: '/images/openai.png',
    initial: 'O',
    color: '#10a37f',
    description: 'GPT 系列模型'
  },
  gemini: {
    name: 'Gemini',
    logo: '/images/gemini.png',
    initial: 'G',
    color: '#4285f4',
    description: 'Google Gemini 系列模型'
  },
  zhipu: {
    name: '智谱AI',
    logo: '/images/zhipu.png',
    initial: '智',
    color: '#3b5df5',
    description: 'GLM 系列模型'
  },
  deepseek: {
    name: 'DeepSeek',
    logo: '/images/deepseek.png',
    initial: 'D',
    color: '#4d6bfe',
    description: 'DeepSeek 系列模型'
  },
  qwen: {
    name: '通义千问',
    logo: '/images/qwen.png',
    initial: '千',
    color: '#615ced',
    description: '阿里云通义千问'
  },
  moonshot: {
    name: 'Moonshot',
    logo: '/images/moonshot.png',
    initial: 'K',
    color: '#000000',
    description: 'Kimi 系列模型'
  },
  grok: {
    name: 'Grok',
    logo: '/images/grok.svg',
    initial: 'G',
    color: '#1d9bf0',
    description: 'xAI Grok 系列模型'
  }
}

export const fallbackProviders = Object.entries(providerMeta).map(([id, meta]) => ({
  id,
  ...meta,
  models: []
}))

export function decorateProvider(provider) {
  const meta = providerMeta[provider.provider] || providerMeta[provider.id] || {}
  const id = provider.provider || provider.id || 'model'
  return {
    id,
    name: meta.name || provider.displayName || id,
    logo: meta.logo,
    initial: meta.initial || String(provider.displayName || id).slice(0, 1).toUpperCase(),
    color: meta.color || '#6366f1',
    description: meta.description || '可用模型',
    models: Array.isArray(provider.models) ? provider.models : []
  }
}
