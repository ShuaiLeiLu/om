// Admin 视图共享的格式化辅助
import { formatBytes, formatNumber, formatRelativeTime } from '@/lib/utils'

export { formatBytes, formatNumber, formatRelativeTime }

export function formatTokens(value) {
  const n = Number(value || 0)
  if (!Number.isFinite(n)) return String(value || 0)
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M'
  if (Math.abs(n) >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return n.toLocaleString('en-US')
}

export function userStatusBadge(status) {
  return status === 'active'
    ? { tone: 'emerald', label: '正常' }
    : status === 'disabled'
      ? { tone: 'rose', label: '已禁用' }
      : { tone: 'slate', label: status || '未知' }
}

export function llmRequestBadge(status) {
  return {
    pending: { tone: 'slate', label: '排队中' },
    streaming: { tone: 'indigo', label: '响应中' },
    completed: { tone: 'emerald', label: '完成' },
    failed: { tone: 'rose', label: '失败' },
    cancelled: { tone: 'amber', label: '取消' }
  }[status] || { tone: 'slate', label: status || '-' }
}

export function quotaLedgerBadge(type) {
  return {
    redeem_code: { tone: 'fuchsia', label: '兑换码' },
    ad_reward: { tone: 'amber', label: '广告奖励' },
    manual_adjustment: { tone: 'indigo', label: '手动调整' },
    model_usage: { tone: 'sky', label: '模型消耗' },
    grant_expired: { tone: 'slate', label: '过期' },
    refund: { tone: 'emerald', label: '退还' }
  }[type] || { tone: 'slate', label: type || '-' }
}

export function shortId(id, len = 8) {
  if (!id) return ''
  const s = String(id)
  return s.length <= len * 2 ? s : `${s.slice(0, len)}…${s.slice(-4)}`
}

export function maskOpenid(openid) {
  if (!openid) return ''
  return openid.length > 8 ? `${openid.slice(0, 5)}***${openid.slice(-3)}` : openid
}
