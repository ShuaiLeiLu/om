const providerMeta = {
  openai: {
    name: 'OpenAI',
    initial: 'AI',
    color: '#1F6B66',
    description: 'GPT 系列模型'
  },
  gemini: {
    name: 'Gemini',
    initial: 'G',
    color: '#5C6BC0',
    description: 'Google Gemini 系列模型'
  },
  zhipu: {
    name: '智谱AI',
    initial: '智',
    color: '#4F6FBD',
    description: 'GLM 系列模型'
  },
  deepseek: {
    name: 'DeepSeek',
    initial: 'D',
    color: '#214F4B',
    description: 'DeepSeek 系列模型'
  },
  qwen: {
    name: '通义千问',
    initial: '千',
    color: '#7B6BBF',
    description: '阿里云通义千问'
  },
  moonshot: {
    name: 'Moonshot',
    initial: 'K',
    color: '#2B2A33',
    description: 'Kimi 系列模型'
  },
  grok: {
    name: 'Grok',
    initial: 'G',
    color: '#2F6F9F',
    description: 'xAI Grok 系列模型'
  },
  midjourney: {
    name: 'Midjourney',
    initial: 'M',
    color: '#6d5dfc',
    description: 'Midjourney 图片生成'
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
    color: meta.color || '#1F6B66',
    description: meta.description || '可用模型',
    models: Array.isArray(provider.models) ? provider.models : []
  }
}
