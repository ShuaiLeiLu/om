export async function fetchModels() {
  const res = await fetch('/api/models', {
    credentials: 'include',
    signal: AbortSignal.timeout(15000)
  })
  const data = await readJson(res)
  if (!res.ok) throw new Error(parseApiError(res.status, data))
  const models = Array.isArray(data) ? data : []
  const groups = new Map()

  for (const model of models) {
    const providerId = model.provider || 'model'
    const group = groups.get(providerId) || {
      id: providerId,
      provider: providerId,
      displayName: providerId,
      models: []
    }
    group.models.push({
      id: model.sub2apiModel,
      name: model.displayName || model.sub2apiModel
    })
    groups.set(providerId, group)
  }

  return Array.from(groups.values())
}

export async function sendMessage({ conversationId, modelId, messages, onDelta }) {
  const res = await fetch('/api/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      conversationId,
      model: modelId,
      messages
    })
  })

  if (!res.ok || !res.body) {
    const data = await readJson(res)
    throw new Error(parseApiError(res.status, data))
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let content = ''
  let meta = null
  let done = null

  while (true) {
    const { value, done: streamDone } = await reader.read()
    if (streamDone) break
    buffer += decoder.decode(value, { stream: true })
    const events = buffer.split('\n\n')
    buffer = events.pop() || ''
    for (const eventText of events) {
      const event = parseSseEvent(eventText)
      if (!event) continue
      if (event.event === 'message.meta') {
        meta = event.data
      } else if (event.event === 'message.delta') {
        const delta = event.data?.content || ''
        content += delta
        onDelta?.(delta)
      } else if (event.event === 'message.done') {
        done = event.data
      } else if (event.event === 'message.error') {
        throw new Error(event.data?.error || '请求失败')
      }
    }
  }

  return { content, meta, done }
}

export async function fetchQuotaSummary() {
  const res = await fetch('/api/quota/summary', {
    credentials: 'include',
    signal: AbortSignal.timeout(15000)
  })
  const data = await readJson(res)
  if (!res.ok) throw new Error(parseApiError(res.status, data))
  return data
}

export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function parseSseEvent(text) {
  const lines = text.split('\n')
  const event = lines.find(line => line.startsWith('event:'))?.slice(6).trim() || 'message'
  const dataLines = lines
    .filter(line => line.startsWith('data:'))
    .map(line => line.slice(5).trim())
  if (dataLines.length === 0) return null
  return { event, data: JSON.parse(dataLines.join('\n')) }
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

function parseApiError(status, data) {
  const message = data?.message || data?.error || ''
  if (status === 401 || message === 'unauthorized') return '请先登录后再使用模型'
  if (message === 'token_insufficient') return 'Token 余额不足，请先领取或兑换 Token'
  if (message === 'model_disabled') return '当前模型暂不可用'
  if (message === 'sub2api_config_incomplete') return '模型网关未配置'
  if (typeof message === 'string' && message) return message
  return `请求失败 (HTTP ${status})`
}
