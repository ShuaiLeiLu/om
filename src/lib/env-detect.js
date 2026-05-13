// Environment / user-agent detection for client-side use only.
// All functions guard against SSR by returning sensible defaults when window is absent.

function ua() {
  if (typeof navigator === 'undefined') return ''
  return navigator.userAgent || ''
}

export function isWechatBrowser() {
  return /MicroMessenger/i.test(ua())
}

export function isWechatMiniProgram() {
  // Mini-program webview also includes "miniProgram" in UA
  return /miniProgram/i.test(ua())
}

export function isIOS() {
  if (typeof navigator === 'undefined') return false
  return /iP(ad|hone|od)/.test(ua()) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

export function isAndroid() {
  return /Android/i.test(ua())
}

export function isMobile() {
  return /Mobi|Android|iP(ad|hone|od)/i.test(ua())
}

export function isPopupSupported() {
  if (typeof window === 'undefined') return false
  // In WeChat in-app browser popups are usually blocked / opened as a new tab — full-page redirect is safer.
  if (isWechatBrowser()) return false
  // Most mobile browsers block popup windows opened outside a user gesture
  if (isMobile()) return false
  return true
}

export function preferredOauthMode() {
  // 微信内置浏览器：用公众号 H5（snsapi_userinfo）
  // 其它环境：用开放平台网站应用（snsapi_login）
  return isWechatBrowser() ? 'h5' : 'web'
}
