// 共享格式化工具
function formatNumber(value) {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return String(value || 0);
  return n.toLocaleString('en-US');
}

function formatRelativeTime(timestamp) {
  if (!timestamp) return '';
  const diff = Date.now() - new Date(timestamp).getTime();
  if (diff < 60 * 1000) return '刚刚';
  if (diff < 60 * 60 * 1000) return Math.floor(diff / 60000) + ' 分钟前';
  if (diff < 24 * 60 * 60 * 1000) return Math.floor(diff / 3600000) + ' 小时前';
  if (diff < 7 * 24 * 60 * 60 * 1000) return Math.floor(diff / 86400000) + ' 天前';
  return new Date(timestamp).toLocaleDateString('zh-CN');
}

function maskEmail(email) {
  if (!email || typeof email !== 'string') return '';
  const at = email.indexOf('@');
  if (at < 2) return email;
  const local = email.slice(0, at);
  const masked = local.slice(0, 2) + '***' + (local.length > 4 ? local.slice(-1) : '');
  return masked + email.slice(at);
}

function progress(current, total) {
  if (!total || total <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((current / total) * 100)));
}

module.exports = {
  formatNumber,
  formatRelativeTime,
  maskEmail,
  progress
};
