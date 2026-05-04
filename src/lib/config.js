const fallbackProviders = [
  {
    id: 'openai',
    name: 'OpenAI',
    logo: '/images/openai.png',
    initial: 'O',
    color: '#10a37f',
    description: 'GPT 系列模型',
    models: [
      { id: 'gpt-5.5', name: 'GPT-5.5' },
      { id: 'gpt-5.4', name: 'GPT-5.4' },
      { id: 'gpt-5.3-codex', name: 'GPT-5.3 Codex' },
      { id: 'gpt-5.2', name: 'GPT-5.2' }
    ],
    apiKey: '',
    baseUrl: '/openai-api/chat/completions',
    modelsUrl: '/openai-api/models'
  },
  {
    id: 'gemini',
    name: 'Gemini',
    logo: '/images/gemini.png',
    initial: 'G',
    color: '#4285f4',
    description: 'Google Gemini 系列模型',
    models: [
      { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro' },
      { id: 'gemini-3-pro-preview', name: 'Gemini 3 Pro' },
      { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash' },
      { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' }
    ],
    apiKey: '',
    baseUrl: '/gemini-api/chat/completions',
    modelsUrl: '/gemini-api/models'
  },
  {
    id: 'zhipu',
    name: '智谱AI',
    logo: '/images/zhipu.png',
    initial: '智',
    color: '#3b5df5',
    description: 'GLM 系列模型',
    models: [
      { id: 'z-ai/glm-5.1', name: 'GLM-5.1' },
      { id: 'z-ai/glm4.7', name: 'GLM-4.7' }
    ],
    apiKey: '',
    baseUrl: '/nvidia-api/chat/completions',
    modelsUrl: '/nvidia-api/models'
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    logo: '/images/deepseek.png',
    initial: 'D',
    color: '#4d6bfe',
    description: 'DeepSeek 系列模型',
    models: [
      { id: 'deepseek-ai/deepseek-v4-flash', name: 'DeepSeek V4 Flash' }
    ],
    apiKey: '',
    baseUrl: '/nvidia-api/chat/completions',
    modelsUrl: '/nvidia-api/models'
  },
  {
    id: 'qwen',
    name: '通义千问',
    logo: '/images/qwen.png',
    initial: '千',
    color: '#615ced',
    description: '阿里云通义千问',
    models: [
      { id: 'qwen/qwen3-coder-480b-a35b-instruct', name: 'Qwen3 Coder 480B' },
      { id: 'qwen/qwen3.5-397b-a17b', name: 'Qwen3.5 397B' },
      { id: 'qwen/qwen3.5-122b-a10b', name: 'Qwen3.5 122B' },
      { id: 'qwen/qwen3-next-80b-a3b-instruct', name: 'Qwen3 Next 80B' },
      { id: 'qwen/qwen3-next-80b-a3b-thinking', name: 'Qwen3 Next 80B Thinking' },
      { id: 'qwen/qwen2.5-coder-32b-instruct', name: 'Qwen2.5 Coder 32B' }
    ],
    apiKey: '',
    baseUrl: '/nvidia-api/chat/completions',
    modelsUrl: '/nvidia-api/models'
  },
  {
    id: 'moonshot',
    name: 'Moonshot',
    logo: '/images/moonshot.png',
    initial: 'K',
    color: '#000000',
    description: 'Kimi 系列模型',
    models: [
      { id: 'moonshotai/kimi-k2-thinking', name: 'Kimi K2 Thinking' },
      { id: 'moonshotai/kimi-k2-instruct-0905', name: 'Kimi K2 Instruct 0905' },
      { id: 'moonshotai/kimi-k2-instruct', name: 'Kimi K2 Instruct' }
    ],
    apiKey: '',
    baseUrl: '/nvidia-api/chat/completions',
    modelsUrl: '/nvidia-api/models'
  },
  {
    id: 'grok',
    name: 'Grok',
    logo: '/images/grok.svg',
    initial: 'G',
    color: '#1d9bf0',
    description: 'xAI Grok 系列模型',
    models: [
      { id: 'grok-4.1-fast', name: 'Grok 4.1 Fast' },
      { id: 'grok-3', name: 'Grok 3' },
      { id: 'grok-3-thinking', name: 'Grok 3 Thinking' },
      { id: 'grok-3-mini', name: 'Grok 3 Mini' }
    ],
    apiKey: '',
    baseUrl: '/grok-api/chat/completions',
    modelsUrl: '/grok-api/models'
  }
]

const runtimeProviders = globalThis.CHATTY_CONFIG?.providers

export const providers = (Array.isArray(runtimeProviders) && runtimeProviders.length > 0
  ? runtimeProviders
  : fallbackProviders
).map(provider => ({
  ...provider,
  models: Array.isArray(provider.models) ? provider.models : []
}))

export const apiKeys = Object.fromEntries(
  providers.map(provider => [provider.id, provider.apiKey || ''])
)
