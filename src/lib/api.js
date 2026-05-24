const DEFAULT_TIMEOUT = 15000

function buildQuery(params = {}) {
  const query = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return
    query.set(key, String(value))
  })
  return query.toString()
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
  if (status === 401 || message === 'unauthorized') return '请先登录'
  if (message === 'invalid_credentials') return '账号或密码不正确'
  if (message === 'username_password_required') return '请输入账号和密码'
  if (message === 'token_insufficient') return '算力点不足，请先领取或兑换'
  if (message === 'model_disabled') return '当前模型暂不可用'
  if (message === 'sub2api_config_incomplete') return '模型网关未配置'
  if (message === 'sub2api_http_503') return '上游模型服务暂时不可用或繁忙，请稍后重试'
  if (message === 'sub2api_http_502') return '上游模型网关返回错误，请稍后重试'
  if (message === 'sub2api_http_504') return '上游模型响应超时，请稍后重试'
  if (message === 'sub2api_http_429') return '上游模型请求过多，请稍后重试'
  if (typeof message === 'string' && message.startsWith('sub2api_http_')) {
    return `上游模型请求失败（HTTP ${message.replace('sub2api_http_', '')}）`
  }
  if (typeof data?.reason === 'string' && data.reason) return `同步失败：${data.reason}`
  if (typeof message === 'string' && message) return message
  return `请求失败 (HTTP ${status})`
}

// Read the CSRF cookie set by the backend's double-submit middleware.
// Returns empty string if running server-side or cookie missing.
function readCsrfCookie() {
  if (typeof document === 'undefined') return ''
  const match = document.cookie.match(/(?:^|;\s*)chatty_csrf=([^;]+)/)
  return match ? decodeURIComponent(match[1]) : ''
}

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

function createTimeoutSignal(timeout) {
  if (!timeout || timeout <= 0) return {}
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
    return { signal: AbortSignal.timeout(timeout) }
  }
  if (typeof AbortController !== 'undefined') {
    const controller = new AbortController()
    const timer = window.setTimeout(() => controller.abort(), timeout)
    return { signal: controller.signal, clear: () => window.clearTimeout(timer) }
  }
  return {}
}

// Shared fetch helper: JSON in, JSON out, normalized error throwing.
// Replaces the boilerplate that used to wrap every endpoint call.
async function fetchJson(url, { method = 'GET', body, timeout = DEFAULT_TIMEOUT, headers } = {}) {
  const timeoutSignal = createTimeoutSignal(timeout)
  const init = {
    method,
    credentials: 'include',
    ...(timeoutSignal.signal ? { signal: timeoutSignal.signal } : {}),
    headers: { ...(headers || {}) }
  }
  if (body !== undefined) {
    init.body = typeof body === 'string' ? body : JSON.stringify(body)
    init.headers = { 'Content-Type': 'application/json', ...init.headers }
  }
  if (UNSAFE_METHODS.has(method.toUpperCase())) {
    const csrf = readCsrfCookie()
    if (csrf) init.headers = { 'X-CSRF-Token': csrf, ...init.headers }
  }
  try {
    const res = await fetch(url, init)
    const data = await readJson(res)
    if (!res.ok) throw new Error(parseApiError(res.status, data))
    if (data && typeof data === 'object' && data.ok === false) {
      throw new Error(parseApiError(res.status, data))
    }
    return data
  } finally {
    timeoutSignal.clear?.()
  }
}

export { readCsrfCookie }

const adminRequest = fetchJson

function parseSseEvent(text) {
  const lines = text.split('\n')
  const event = lines.find(line => line.startsWith('event:'))?.slice(6).trim() || 'message'
  const dataLines = lines
    .filter(line => line.startsWith('data:'))
    .map(line => line.slice(5).trim())
  if (dataLines.length === 0) return null
  return { event, data: JSON.parse(dataLines.join('\n')) }
}

// ---------- Models / Chat ----------

export async function fetchModels() {
  const data = await fetchJson('/api/models')
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
  const csrf = readCsrfCookie()
  const res = await fetch('/api/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(csrf ? { 'X-CSRF-Token': csrf } : {}) },
    credentials: 'include',
    body: JSON.stringify({ conversationId, model: modelId, messages })
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
        throw new Error(parseApiError(200, { message: event.data?.error || '请求失败' }))
      }
    }
  }

  return { content, meta, done }
}

export function generateImage({ conversationId, modelId, prompt }) {
  return fetchJson('/api/images/generations', {
    method: 'POST',
    body: { conversationId, model: modelId, prompt }
  })
}

// ---------- Account ----------

export const fetchQuotaSummary = () => fetchJson('/api/quota/summary')
export const fetchMe = () => fetchJson('/api/me')
export const logout = () => fetchJson('/api/auth/logout', { method: 'POST' })

// ---------- WeChat QR login ----------

export const createWechatLoginSession = () =>
  fetchJson('/api/auth/wechat-miniapp/sessions', { method: 'POST' })

export const fetchWechatLoginSession = (sessionId) =>
  fetchJson(`/api/auth/wechat-miniapp/sessions/${encodeURIComponent(sessionId)}`)

export function subscribeSessionSse(sessionId) {
  return new EventSource(`/api/auth/wechat-miniapp/sessions/${encodeURIComponent(sessionId)}/sse`)
}

export const verifyLoginCode = (code) =>
  fetchJson('/api/auth/wechat-miniapp/login-code/verify', { method: 'POST', body: { code } })

// ---------- Local auth ----------

export const sendLocalCode = ({ email, purpose = 'register' }) =>
  fetchJson('/api/auth/local/send-code', { method: 'POST', body: { email, purpose } })

export const localResetPassword = ({ email, code, newPassword }) =>
  fetchJson('/api/auth/local/reset-password', { method: 'POST', body: { email, code, newPassword } })

export const localLogin = ({ email, password }) =>
  fetchJson('/api/auth/local/login', { method: 'POST', body: { email, password } })

export const localRegister = ({ email, password, displayName, code }) =>
  fetchJson('/api/auth/local/register', { method: 'POST', body: { email, password, displayName, code } })

export const localChangePassword = ({ oldPassword, newPassword }) =>
  fetchJson('/api/auth/local/change-password', { method: 'POST', body: { oldPassword, newPassword } })

export async function fetchAuthCapabilities() {
  try {
    return await fetchJson('/api/auth/capabilities', { timeout: 8000 })
  } catch {
    // 后端未启用 capabilities 时给一个保守默认（只允许扫码）
    return { qrcode: true, wechatOauthWeb: false, wechatOauthH5: false }
  }
}

// 一键登录：拼接前端发起的授权 URL。
// 实际跳转 / popup 打开由调用方决定。
export function buildWechatOauthStartUrl({ mode = 'web', next = '/', popup = false, format = 'redirect' } = {}) {
  const params = new URLSearchParams({ mode, next, popup: popup ? '1' : '0', format })
  return `/api/auth/wechat/oauth/start?${params.toString()}`
}

export const fetchWechatOauthStartUrl = ({ mode = 'web', next = '/', popup = false } = {}) =>
  fetchJson(buildWechatOauthStartUrl({ mode, next, popup, format: 'json' }), { timeout: 8000 })

// ---------- Quota ----------

export async function fetchQuotaLedger({ page = 1, pageSize = 20 } = {}) {
  const qs = buildQuery({ page, pageSize })
  const data = await fetchJson(`/api/quota/ledger?${qs}`)
  return Array.isArray(data) ? data : []
}

export const redeemCode = (code) =>
  fetchJson('/api/redeem', { method: 'POST', body: { code } })

export const fetchRechargePlans = () => fetchJson('/api/recharge/plans')

export const fetchRechargeOrders = () => fetchJson('/api/recharge/orders')

export const createRechargeOrder = ({ planId, paymentMethod = 'wechat' }) =>
  fetchJson('/api/recharge/orders', { method: 'POST', body: { planId, paymentMethod } })

// ---------- Rewards ----------

export const fetchRewardsConfig = () => fetchJson('/api/rewards/config')

export const createRewardsSession = () =>
  fetchJson('/api/rewards/sessions', { method: 'POST' })

export const claimRewards = (rewardSessionId) =>
  fetchJson('/api/rewards/claim', { method: 'POST', body: { rewardSessionId } })

export const fetchCheckinStatus = () => fetchJson('/api/rewards/checkin/status')

export const performCheckin = () =>
  fetchJson('/api/rewards/checkin', { method: 'POST' })

export const fetchDailyTasksStatus = () => fetchJson('/api/rewards/tasks/status')

export const claimTaskReward = (taskType) =>
  fetchJson('/api/rewards/tasks/claim', { method: 'POST', body: { taskType } })

// ---------- Admin ----------

export const adminLogin = ({ username, password }) =>
  adminRequest('/api/admin/auth/login', { method: 'POST', body: { username, password } })

export const adminLogout = () => adminRequest('/api/admin/auth/logout', { method: 'POST' })
export const fetchAdminMe = () => adminRequest('/api/admin/me')
export const fetchAdminDashboard = () => adminRequest('/api/admin/dashboard')

export const fetchAdminUsers = (params = {}) =>
  adminRequest(`/api/admin/users?${buildQuery(params)}`)

export function updateAdminUserStatus(userId, status) {
  const action = status === 'active' ? 'enable' : 'disable'
  return adminRequest(`/api/admin/users/${encodeURIComponent(userId)}/${action}`, { method: 'POST' })
}

export const deleteAdminUser = (userId) =>
  adminRequest(`/api/admin/users/${encodeURIComponent(userId)}`, { method: 'DELETE' })

export const adjustAdminQuota = (userId, body) =>
  adminRequest(`/api/admin/users/${encodeURIComponent(userId)}/quota-adjust`, { method: 'POST', body })

export const fetchAdminModels = () => adminRequest('/api/admin/models')

export const updateAdminModel = (modelId, body) =>
  adminRequest(`/api/admin/models/${encodeURIComponent(modelId)}`, { method: 'PATCH', body })

export const fetchAdminPlans = () => adminRequest('/api/admin/plans')
export const createAdminPlan = (body) => adminRequest('/api/admin/plans', { method: 'POST', body })

export const fetchAdminRedeemCodes = () => adminRequest('/api/admin/redeem-codes')

export const createAdminRedeemCodes = (body) =>
  adminRequest('/api/admin/redeem-codes/batch', { method: 'POST', body })

export const revokeAdminRedeemCode = (codeId) =>
  adminRequest(`/api/admin/redeem-codes/${encodeURIComponent(codeId)}/revoke`, { method: 'POST' })

export const fetchAdminLlmRequests = (params = {}) =>
  adminRequest(`/api/admin/llm-requests?${buildQuery(params)}`)

export const fetchAdminQuotaLedger = (params = {}) =>
  adminRequest(`/api/admin/quota-ledger?${buildQuery(params)}`)

export const fetchAdminUsageEvents = () => adminRequest('/api/admin/usage-events')

export const fetchAdminRechargeOrders = () => adminRequest('/api/admin/recharge-orders')

export const markAdminRechargeOrderPaid = (orderId) =>
  adminRequest(`/api/admin/recharge-orders/${encodeURIComponent(orderId)}/mark-paid`, { method: 'POST', body: {} })

export const syncAdminSub2api = () =>
  adminRequest('/api/admin/sub2api/sync', { method: 'POST' })

export const fetchAdminWechatAccounts = (params = {}) =>
  adminRequest(`/api/admin/wechat/accounts?${buildQuery(params)}`)

export const unbindAdminWechatAccount = (accountId) =>
  adminRequest(`/api/admin/wechat/accounts/${encodeURIComponent(accountId)}/unbind`, { method: 'POST' })

export const fetchAdminRewardConfig = () => adminRequest('/api/admin/wechat/reward-config')

export const updateAdminRewardConfig = (body) =>
  adminRequest('/api/admin/wechat/reward-config', { method: 'PATCH', body })

export const fetchAdminRewardEvents = () => adminRequest('/api/admin/wechat/reward-events')

export const fetchAdminAuditLogs = (params = {}) =>
  adminRequest(`/api/admin/audit-logs?${buildQuery(params)}`)

// ---------- Utilities ----------

export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
