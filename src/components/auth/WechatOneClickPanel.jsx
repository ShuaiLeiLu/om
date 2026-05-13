'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Sparkles, ArrowRight, AlertCircle, CheckCircle2 } from 'lucide-react'
import { fetchMe, fetchQuotaSummary, buildWechatOauthStartUrl, fetchWechatOauthStartUrl } from '@/lib/api'
import { useAuthStore } from '@/store/useStore'
import { isWechatBrowser, isPopupSupported, preferredOauthMode } from '@/lib/env-detect'
import { cn } from '@/lib/utils'

const POPUP_FEATURES = 'width=460,height=620,menubar=no,toolbar=no,location=no,status=no'

// One-click WeChat login via 微信开放平台 OAuth (snsapi_login / snsapi_userinfo).
//
// Behavior matrix:
//   桌面浏览器           → 新开 popup 打开授权页，监听 postMessage / 轮询 me 确认登录
//   移动浏览器           → 同窗口跳转到授权页（popup 会被拦截）
//   微信内置浏览器       → 同窗口跳转 H5 授权（snsapi_userinfo）
//   后端未配置该模式时   → 显示禁用提示并引导切到扫码登录
//
// 登录成功后调用 setSession + 跳转 next。
export function WechatOneClickPanel({
  mode: forcedMode,
  available,
  nextUrl = '/profile',
  onUnavailable,
  onSwitchToQrcode
}) {
  const router = useRouter()
  const { setSession } = useAuthStore()
  const [phase, setPhase] = useState('idle') // idle | starting | waiting | success | failed
  const [error, setError] = useState('')
  const popupRef = useRef(null)
  const pollTimerRef = useRef(null)
  const closeWatcherRef = useRef(null)

  const inWechat = isWechatBrowser()
  const mode = forcedMode || preferredOauthMode()
  const isAvailable = !available
    ? true
    : mode === 'h5'
      ? available.wechatOauthH5
      : available.wechatOauthWeb

  const cleanup = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current)
      pollTimerRef.current = null
    }
    if (closeWatcherRef.current) {
      clearInterval(closeWatcherRef.current)
      closeWatcherRef.current = null
    }
    if (popupRef.current && !popupRef.current.closed) {
      try {
        popupRef.current.close()
      } catch {}
    }
    popupRef.current = null
  }, [])

  useEffect(() => () => cleanup(), [cleanup])

  const onSuccess = useCallback(async () => {
    try {
      setPhase('success')
      const [user, quota] = await Promise.all([fetchMe(), fetchQuotaSummary()])
      setSession({ user, quota })
      router.replace(nextUrl)
    } catch (err) {
      setPhase('failed')
      setError(err.message || '会话同步失败')
    }
  }, [router, nextUrl, setSession])

  const startPopup = useCallback(async () => {
    setError('')
    setPhase('starting')
    try {
      // Open popup synchronously to avoid pop-up blockers, fill URL after fetch.
      const placeholder = window.open('about:blank', 'chatty_wechat_oauth', POPUP_FEATURES)
      if (!placeholder) {
        setPhase('failed')
        setError('浏览器拦截了弹窗，请允许弹窗或改用扫码登录')
        return
      }
      popupRef.current = placeholder
      const { url } = await fetchWechatOauthStartUrl({ mode, next: nextUrl, popup: true })
      placeholder.location.replace(url)
      setPhase('waiting')

      // Listen for postMessage from the callback page
      const handler = (ev) => {
        const data = ev.data
        if (!data || data.type !== 'chatty:wechat_oauth') return
        window.removeEventListener('message', handler)
        if (data.ok) onSuccess()
        else {
          setPhase('failed')
          setError(data.message || '授权失败')
        }
        cleanup()
      }
      window.addEventListener('message', handler)

      // If user closes popup manually
      closeWatcherRef.current = setInterval(() => {
        if (popupRef.current && popupRef.current.closed) {
          window.removeEventListener('message', handler)
          cleanup()
          // Final attempt to verify session in case postMessage was missed
          fetchMe()
            .then((user) => {
              if (user) {
                fetchQuotaSummary()
                  .then((quota) => setSession({ user, quota }))
                  .catch(() => {})
                router.replace(nextUrl)
              } else {
                setPhase('idle')
              }
            })
            .catch(() => setPhase('idle'))
        }
      }, 600)
    } catch (err) {
      cleanup()
      setPhase('failed')
      setError(err.message || '一键登录失败')
    }
  }, [cleanup, mode, nextUrl, onSuccess, router, setSession])

  const startRedirect = useCallback(() => {
    setError('')
    setPhase('starting')
    const url = buildWechatOauthStartUrl({ mode, next: nextUrl, popup: false, format: 'redirect' })
    window.location.href = url
  }, [mode, nextUrl])

  const onStart = useCallback(() => {
    if (!isAvailable) {
      onUnavailable?.()
      return
    }
    if (isPopupSupported()) startPopup()
    else startRedirect()
  }, [isAvailable, onUnavailable, startPopup, startRedirect])

  if (!isAvailable) {
    return (
      <div className="space-y-4">
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-amber-400/25 bg-amber-500/10 px-5 py-8 text-center backdrop-blur-xl">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/15">
            <AlertCircle className="text-amber-300" size={22} />
          </div>
          <div>
            <p className="text-sm font-medium text-amber-100">一键登录暂未启用</p>
            <p className="mt-1 max-w-sm text-xs text-amber-100/70 leading-relaxed">
              后端尚未配置微信开放平台 AppID，可以改用 <button onClick={onSwitchToQrcode} className="underline underline-offset-2 hover:text-amber-50">扫码登录</button>。
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <PrimaryButton phase={phase} onClick={onStart} inWechat={inWechat} mode={mode} />

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
          <AlertCircle size={13} className="mt-0.5 shrink-0" />
          <span className="flex-1 min-w-0 break-words">{error}</span>
        </div>
      )}

      <div className="flex flex-col gap-2 rounded-2xl border border-white/8 bg-white/[0.02] p-3 text-[11px] text-slate-400">
        <div className="flex items-start gap-2">
          <span className="mt-0.5 text-emerald-300">●</span>
          <span>
            {inWechat
              ? '当前在微信内打开，将使用 H5 授权直接登录'
              : isPopupSupported()
                ? '将在新窗口打开微信授权，确认后自动返回'
                : '将跳转到微信授权页，登录后自动返回'}
          </span>
        </div>
        <div className="flex items-start gap-2">
          <span className="mt-0.5 text-emerald-300">●</span>
          <span>同一个微信身份与网页 / 小程序 Token 余额完全同步</span>
        </div>
      </div>

      {onSwitchToQrcode && (
        <button
          onClick={onSwitchToQrcode}
          className="flex w-full min-h-[40px] items-center justify-center gap-1.5 rounded-xl text-xs text-slate-400 transition hover:text-slate-200 tap-transparent"
        >
          没有微信？改用扫码登录 <ArrowRight size={11} />
        </button>
      )}
    </div>
  )
}

function PrimaryButton({ phase, onClick, inWechat, mode }) {
  const label =
    phase === 'starting'
      ? '准备授权...'
      : phase === 'waiting'
        ? '等待微信确认...'
        : phase === 'success'
          ? '登录成功，跳转中...'
          : phase === 'failed'
            ? '重试一键登录'
            : inWechat
              ? '点击使用微信账号登录'
              : '使用微信一键登录'

  const Icon = phase === 'starting' || phase === 'waiting' ? Loader2 : phase === 'success' ? CheckCircle2 : Sparkles

  const disabled = phase === 'starting' || phase === 'waiting' || phase === 'success'

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'group flex w-full min-h-[52px] items-center justify-center gap-2.5 rounded-2xl px-5 py-3.5 text-sm font-semibold text-white transition-all tap-transparent',
        'bg-gradient-to-br from-emerald-500 via-emerald-500 to-teal-500',
        'shadow-[0_10px_30px_rgba(16,185,129,0.35)] hover:brightness-110 active:scale-[0.98]',
        disabled && 'opacity-80 pointer-events-none'
      )}
    >
      <span
        className={cn(
          'flex h-7 w-7 items-center justify-center rounded-lg bg-white/15',
          (phase === 'starting' || phase === 'waiting') && 'animate-pulse'
        )}
      >
        <Icon size={16} className={phase === 'starting' || phase === 'waiting' ? 'animate-spin' : ''} />
      </span>
      <span>{label}</span>
      {mode === 'h5' && (
        <span className="ml-1 rounded-full bg-white/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider">H5</span>
      )}
    </button>
  )
}

export default WechatOneClickPanel
