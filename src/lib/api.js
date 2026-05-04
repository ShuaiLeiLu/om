/**
 * 多模型 API 适配层 (H5 版本)
 * 统一封装不同厂商的请求格式和响应解析
 */

export function buildRequest(providerId, baseUrl, modelId, apiKey, messages) {
  switch (providerId) {
    case 'anthropic':
      return buildAnthropicRequest(baseUrl, modelId, apiKey, messages)
    default:
      return buildOpenAIRequest(baseUrl, modelId, apiKey, messages)
  }
}

function buildOpenAIRequest(baseUrl, modelId, apiKey, messages) {
  const formattedMessages = messages.map(m => {
    if (m.images && m.images.length > 0) {
      const content = []
      m.images.forEach(img => {
        content.push({ type: 'image_url', image_url: { url: img } })
      })
      if (m.content) {
        content.push({ type: 'text', text: m.content })
      }
      return { role: m.role, content }
    }
    return { role: m.role, content: m.content }
  })

  return {
    url: baseUrl,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: {
      model: modelId,
      messages: formattedMessages,
      max_tokens: 4096,
      temperature: 0.7,
      stream: false
    }
  }
}

function buildAnthropicRequest(baseUrl, modelId, apiKey, messages) {
  let systemPrompt = ''
  const filteredMessages = []

  messages.forEach(m => {
    if (m.role === 'system') {
      systemPrompt = m.content
    } else if (m.images && m.images.length > 0) {
      const content = []
      m.images.forEach(img => {
        const match = img.match(/^data:(image\/\w+);base64,(.+)$/)
        if (match) {
          content.push({
            type: 'image',
            source: { type: 'base64', media_type: match[1], data: match[2] }
          })
        }
      })
      if (m.content) {
        content.push({ type: 'text', text: m.content })
      }
      filteredMessages.push({ role: m.role, content })
    } else {
      filteredMessages.push({ role: m.role, content: m.content })
    }
  })

  const body = {
    model: modelId,
    max_tokens: 4096,
    messages: filteredMessages
  }
  if (systemPrompt) body.system = systemPrompt

  return {
    url: baseUrl,
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body
  }
}

export function parseResponse(providerId, data) {
  try {
    switch (providerId) {
      case 'anthropic':
        if (data?.content?.length > 0) {
          return data.content.filter(b => b.type === 'text').map(b => b.text).join('')
        }
        return null
      default:
        if (data?.choices?.length > 0) {
          const c = data.choices[0]
          return c.message ? c.message.content : (c.text || '')
        }
        return null
    }
  } catch (e) {
    console.error('Parse response error:', e)
    return null
  }
}

export function parseError(status, data) {
  if (data?.error?.message) return data.error.message
  if (data?.message) return data.message
  
  if (status === 401) return 'API Key 无效或已过期'
  if (status === 403) return '无权访问该模型'
  if (status === 429) return '请求过于频繁，请稍后再试'
  if (status === 500) return '服务器内部错误'
  if (status === 502 || status === 503) return '服务暂时不可用'

  if (data) {
    if (typeof data === 'string') return `错误 (${status}): ${data.substring(0, 100)}`
    if (data.error) {
      if (typeof data.error === 'string') return data.error
      if (data.error.message) return data.error.message
    }
    if (data.message) return data.message
  }
  return `请求失败 (HTTP ${status})`
}

export async function sendMessage(providerId, baseUrl, modelId, apiKey, messages) {
  const config = buildRequest(providerId, baseUrl, modelId, apiKey, messages)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 45000)
  let res
  try {
    res = await fetch(config.url, {
      method: 'POST',
      headers: config.headers,
      body: JSON.stringify(config.body),
      signal: controller.signal
    })
  } catch (err) {
    if (err?.name === 'AbortError') {
      throw new Error('模型响应超时，请切换模型后重试')
    }
    throw err
  } finally {
    clearTimeout(timeout)
  }

  const contentType = res.headers.get('content-type') || ''
  const isJson = contentType.includes('application/json')
  const data = isJson ? await res.json() : await res.text()

  if (!res.ok) {
    throw new Error(parseError(res.status, data))
  }

  if (!isJson) {
    throw new Error('接口返回了非 JSON 内容，请检查网关反向代理配置')
  }

  const content = parseResponse(providerId, data)
  if (!content) throw new Error('未获取到有效回复')
  return content
}

export async function fetchModels(providerId, modelsUrl, apiKey) {
  const headers = {}
  if (providerId === 'anthropic') {
    headers['x-api-key'] = apiKey
    headers['anthropic-version'] = '2023-06-01'
  } else {
    headers['Authorization'] = `Bearer ${apiKey}`
  }

  const res = await fetch(modelsUrl, { headers, signal: AbortSignal.timeout(15000) })
  if (!res.ok) {
    const contentType = res.headers.get('content-type') || ''
    const data = contentType.includes('application/json')
      ? await res.json().catch(() => null)
      : await res.text().catch(() => null)
    throw new Error(parseError(res.status, data))
  }

  const contentType = res.headers.get('content-type') || ''
  if (!contentType.includes('application/json')) {
    throw new Error('模型列表接口返回了非 JSON 内容，请检查网关反向代理配置')
  }

  const data = await res.json()
  let models = []

  if (providerId === 'anthropic') {
    if (data?.data) {
      models = data.data.map(m => ({ id: m.id, name: m.display_name || m.id }))
    }
  } else {
    if (data?.data) {
      models = data.data.map(m => ({ id: m.id, name: m.id }))
    }
  }

  if (models.length === 0) throw new Error('未获取到可用模型')
  return models.sort((a, b) => a.id.localeCompare(b.id))
}

export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
