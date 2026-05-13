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
      name: model.displayName || model.sub2apiModel,
      remark: model.remark || ''
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

export async function generateImage({ conversationId, modelId, prompt }) {
  const res = await fetch('/api/images/generations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      conversationId,
      model: modelId,
      prompt
    })
  })
  const data = await readJson(res)
  if (!res.ok) throw new Error(parseApiError(res.status, data))
  return data
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

export async function fetchMe() {
  const res = await fetch('/api/me', {
    credentials: 'include',
    signal: AbortSignal.timeout(15000)
  })
  const data = await readJson(res)
  if (!res.ok) throw new Error(parseApiError(res.status, data))
  return data
}

export async function logout() {
  const res = await fetch('/api/auth/logout', {
    method: 'POST',
    credentials: 'include',
    signal: AbortSignal.timeout(15000)
  })
  const data = await readJson(res)
  if (!res.ok) throw new Error(parseApiError(res.status, data))
  return data
}

export async function createWechatLoginSession() {
  const res = await fetch('/api/auth/wechat-miniapp/sessions', {
    method: 'POST',
    credentials: 'include',
    signal: AbortSignal.timeout(15000)
  })
  const data = await readJson(res)
  if (!res.ok) throw new Error(parseApiError(res.status, data))
  return data
}

export async function fetchWechatLoginSession(sessionId) {
  const res = await fetch(`/api/auth/wechat-miniapp/sessions/${encodeURIComponent(sessionId)}`, {
    credentials: 'include',
    signal: AbortSignal.timeout(15000)
  })
  const data = await readJson(res)
  if (!res.ok) throw new Error(parseApiError(res.status, data))
  return data
}

export async function localLogin({ email, password }) {
  const res = await fetch('/api/auth/local/login', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
    signal: AbortSignal.timeout(15000)
  })
  const data = await readJson(res)
  if (!res.ok) throw new Error(parseApiError(res.status, data))
  return data
}

export async function localRegister({ email, password, displayName }) {
  const res = await fetch('/api/auth/local/register', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, displayName }),
    signal: AbortSignal.timeout(15000)
  })
  const data = await readJson(res)
  if (!res.ok) throw new Error(parseApiError(res.status, data))
  return data
}

export async function localChangePassword({ oldPassword, newPassword }) {
  const res = await fetch('/api/auth/local/change-password', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ oldPassword, newPassword }),
    signal: AbortSignal.timeout(15000)
  })
  const data = await readJson(res)
  if (!res.ok) throw new Error(parseApiError(res.status, data))
  return data
}

export async function fetchAuthCapabilities() {
  const res = await fetch('/api/auth/capabilities', {
    credentials: 'include',
    signal: AbortSignal.timeout(8000)
  })
  const data = await readJson(res)
  if (!res.ok) {
    // 后端未启用 capabilities 时给一个保守默认（只允许扫码）
    return { qrcode: true, wechatOauthWeb: false, wechatOauthH5: false }
  }
  return data
}

// 一键登录：拼接前端发起的授权 URL。
// 实际跳转 / popup 打开由调用方决定。
export function buildWechatOauthStartUrl({ mode = 'web', next = '/', popup = false, format = 'redirect' } = {}) {
  const params = new URLSearchParams({
    mode,
    next,
    popup: popup ? '1' : '0',
    format
  })
  return `/api/auth/wechat/oauth/start?${params.toString()}`
}

export async function fetchWechatOauthStartUrl({ mode = 'web', next = '/', popup = false } = {}) {
  const url = buildWechatOauthStartUrl({ mode, next, popup, format: 'json' })
  const res = await fetch(url, {
    credentials: 'include',
    signal: AbortSignal.timeout(8000)
  })
  const data = await readJson(res)
  if (!res.ok) throw new Error(parseApiError(res.status, data))
  return data
}

export async function fetchQuotaLedger({ page = 1, pageSize = 20 } = {}) {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
  const res = await fetch(`/api/quota/ledger?${params.toString()}`, {
    credentials: 'include',
    signal: AbortSignal.timeout(15000)
  })
  const data = await readJson(res)
  if (!res.ok) throw new Error(parseApiError(res.status, data))
  return Array.isArray(data) ? data : []
}

export async function adminLogin({ username, password }) {
  return adminRequest('/api/admin/auth/login', {
    method: 'POST',
    body: { username, password }
  })
}

export async function adminLogout() {
  return adminRequest('/api/admin/auth/logout', { method: 'POST' })
}

export async function fetchAdminMe() {
  return adminRequest('/api/admin/me')
}

export async function fetchAdminDashboard() {
  return adminRequest('/api/admin/dashboard')
}

export async function fetchAdminUsers(params = {}) {
  return adminRequest(`/api/admin/users?${buildQuery(params)}`)
}

export async function updateAdminUserStatus(userId, status) {
  const action = status === 'active' ? 'enable' : 'disable'
  return adminRequest(`/api/admin/users/${encodeURIComponent(userId)}/${action}`, { method: 'POST' })
}

export async function adjustAdminQuota(userId, body) {
  return adminRequest(`/api/admin/users/${encodeURIComponent(userId)}/quota-adjust`, {
    method: 'POST',
    body
  })
}

export async function fetchAdminModels() {
  return adminRequest('/api/admin/models')
}

export async function updateAdminModel(modelId, body) {
  return adminRequest(`/api/admin/models/${encodeURIComponent(modelId)}`, {
    method: 'PATCH',
    body
  })
}

export async function fetchAdminPlans() {
  return adminRequest('/api/admin/plans')
}

export async function createAdminPlan(body) {
  return adminRequest('/api/admin/plans', {
    method: 'POST',
    body
  })
}

export async function fetchAdminRedeemCodes() {
  return adminRequest('/api/admin/redeem-codes')
}

export async function createAdminRedeemCodes(body) {
  return adminRequest('/api/admin/redeem-codes/batch', {
    method: 'POST',
    body
  })
}

export async function revokeAdminRedeemCode(codeId) {
  return adminRequest(`/api/admin/redeem-codes/${encodeURIComponent(codeId)}/revoke`, { method: 'POST' })
}

export async function fetchAdminLlmRequests(params = {}) {
  return adminRequest(`/api/admin/llm-requests?${buildQuery(params)}`)
}

export async function fetchAdminQuotaLedger(params = {}) {
  return adminRequest(`/api/admin/quota-ledger?${buildQuery(params)}`)
}

export async function fetchAdminUsageEvents() {
  return adminRequest('/api/admin/usage-events')
}

export async function syncAdminSub2api() {
  return adminRequest('/api/admin/sub2api/sync', { method: 'POST' })
}

export async function fetchAdminWechatAccounts(params = {}) {
  return adminRequest(`/api/admin/wechat/accounts?${buildQuery(params)}`)
}

export async function unbindAdminWechatAccount(accountId) {
  return adminRequest(`/api/admin/wechat/accounts/${encodeURIComponent(accountId)}/unbind`, { method: 'POST' })
}

export async function fetchAdminRewardConfig() {
  return adminRequest('/api/admin/wechat/reward-config')
}

export async function updateAdminRewardConfig(body) {
  return adminRequest('/api/admin/wechat/reward-config', {
    method: 'PATCH',
    body
  })
}

export async function fetchAdminRewardEvents() {
  return adminRequest('/api/admin/wechat/reward-events')
}

export async function fetchAdminAuditLogs(params = {}) {
  return adminRequest(`/api/admin/audit-logs?${buildQuery(params)}`)
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

async function adminRequest(url, options = {}) {
  const headers = { ...(options.headers || {}) }
  const init = {
    method: options.method || 'GET',
    credentials: 'include',
    signal: AbortSignal.timeout(options.timeout || 15000),
    headers
  }
  if (options.body !== undefined) {
    init.body = JSON.stringify(options.body)
    init.headers = { 'Content-Type': 'application/json', ...headers }
  }
  const res = await fetch(url, init)
  const data = await readJson(res)
  if (!res.ok) throw new Error(parseApiError(res.status, data))
  if (data && typeof data === 'object' && data.ok === false) {
    throw new Error(parseApiError(res.status, data))
  }
  return data
}

function buildQuery(params = {}) {
  const query = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return
    query.set(key, String(value))
  })
  return query.toString()
}

function parseApiError(status, data) {
  const message = data?.message || data?.error || ''
  if (status === 401 || message === 'unauthorized') return '请先登录'
  if (message === 'invalid_credentials') return '账号或密码不正确'
  if (message === 'username_password_required') return '请输入账号和密码'
  if (message === 'token_insufficient') return 'Token 余额不足，请先领取或兑换 Token'
  if (message === 'model_disabled') return '当前模型暂不可用'
  if (message === 'sub2api_config_incomplete') return '模型网关未配置'
  if (typeof data?.reason === 'string' && data.reason) return `同步失败：${data.reason}`
  if (typeof message === 'string' && message) return message
  return `请求失败 (HTTP ${status})`
}
