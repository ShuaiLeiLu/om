'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  Loader2,
  QrCode,
  RefreshCw,
  ScanLine,
  Smartphone
} from 'lucide-react'
import { createWechatLoginSession, fetchMe, fetchQuotaSummary, fetchWechatLoginSession, subscribeSessionSse } from '@/lib/api'
import { useAuthStore } from '@/store/useStore'
import { cn } from '@/lib/utils'

const STATUS_LABEL = {
  pending: '请使用微信扫码',
  scanned: '已扫码，正在确认...',
  confirmed: '登录成功，正在进入...',
  expired: '二维码已过期，请刷新',
  cancelled: '登录已取消，请刷新',
  failed: '登录失败，请刷新'
}

export function WechatQrPanel({ nextUrl = '/profile' }) {
  const router = useRouter()
  const { setSession } = useAuthStore()
  const [session, setLoginSession] = useState(null)
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')

  const qrUrl = useMemo(() => {
    if (!session?.qrImageUrl) return ''
    return `${session.qrImageUrl}?t=${encodeURIComponent(session.sessionId)}`
  }, [session])

  const startLogin = useCallback(async () => {
    try {
      setStatus('loading')
      setError('')
      const next = await createWechatLoginSession()
      setLoginSession(next)
      setStatus('pending')
    } catch (err) {
      setStatus('failed')
      setError(err.message || '二维码创建失败')
    }
  }, [])

  useEffect(() => {
    startLogin()
  }, [startLogin])

  // SSE 实时监听，fallback 到轮询
  useEffect(() => {
    if (!session?.sessionId) return
    if (status === 'confirmed' || status === 'expired' || status === 'failed') return

    let stopped = false
    let sse = null
    let fallbackTimer = null

    const handleConfirmed = async () => {
      if (stopped) return
      stopped = true
      setStatus('confirmed')
      try {
        const [user, quota] = await Promise.all([fetchMe(), fetchQuotaSummary()])
        setSession({ user, quota })
        router.replace(nextUrl)
      } catch (err) {
        setStatus('failed')
        setError(err.message || '登录状态同步失败')
      }
    }

    const handleStatus = (newStatus) => {
      if (stopped) return
      setStatus(newStatus)
      if (newStatus === 'confirmed') handleConfirmed()
      if (newStatus === 'expired' || newStatus === 'failed') stopped = true
    }

    // 尝试 SSE
    try {
      sse = subscribeSessionSse(session.sessionId)
      sse.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          handleStatus(data.status)
        } catch {}
      }
      sse.onerror = () => {
        // SSE 失败，降级到轮询
        if (sse) { sse.close(); sse = null }
        if (!stopped) startPolling()
      }
    } catch {
      startPolling()
    }

    function startPolling() {
      if (stopped || fallbackTimer) return
      fallbackTimer = window.setInterval(async () => {
        try {
          const next = await fetchWechatLoginSession(session.sessionId)
          if (stopped) return
          handleStatus(next.status)
        } catch (err) {
          if (stopped) return
          setStatus('failed')
          setError(err.message || '登录状态同步失败')
          stopped = true
        }
      }, 1800)
    }

    return () => {
      stopped = true
      if (sse) { sse.close(); sse = null }
      if (fallbackTimer) { window.clearInterval(fallbackTimer); fallbackTimer = null }
    }
  }, [router, session, setSession, status, nextUrl])

  const isLoading = status === 'loading'
  const isFailed = status === 'failed' || status === 'expired'
  const isSuccess = status === 'confirmed'

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="flex items-center gap-1.5 text-xs font-semibold text-ink-900">
            <ScanLine size={12} className="text-celadon-600" />
            微信扫码登录
          </p>
          <p className="mt-0.5 text-[10px] text-ink-500">二维码 5 分钟内有效</p>
        </div>
        <button
          onClick={startLogin}
          disabled={isLoading}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-ink-700/10 bg-rice-50 text-ink-600 transition hover:bg-rice-100 disabled:opacity-50 tap-transparent"
          aria-label="刷新二维码"
        >
          <RefreshCw size={13} className={cn(isLoading && 'animate-spin')} />
        </button>
      </div>

      <div className="relative mx-auto aspect-square w-full max-w-[260px] overflow-hidden rounded-2xl border border-ink-700/10 bg-white p-3 shadow-[var(--shadow-paper)]">
        {qrUrl && !isLoading && !isFailed ? (
          <img
            src={qrUrl}
            alt="微信扫码登录二维码"
            className={cn(
              'h-full w-full rounded-xl object-contain transition',
              isSuccess && 'blur-sm opacity-50'
            )}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center rounded-xl bg-rice-100">
            {isFailed ? (
              <QrCode className="text-ink-400" size={48} strokeWidth={1.5} />
            ) : (
              <Loader2 size={34} className="animate-spin text-ink-400" />
            )}
          </div>
        )}

        {isSuccess && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-celadon-500/10 backdrop-blur-sm">
            <CheckCircle2 size={36} className="text-celadon-600" />
            <p className="text-sm font-semibold text-celadon-700">登录成功</p>
          </div>
        )}
      </div>

      <StatusBanner status={status} error={error} />

      <div className="flex items-start gap-2.5 rounded-xl border border-ink-700/10 bg-rice-100 px-3 py-2.5 text-[10px] text-ink-500">
        <Smartphone size={13} className="mt-0.5 shrink-0 text-ink-500" />
        <span className="leading-relaxed">
          手机微信扫码后自动完成登录，无需额外确认
        </span>
      </div>
    </div>
  )
}

function StatusBanner({ status, error }) {
  const isSuccess = status === 'confirmed'
  const isLoading = status === 'loading'
  const isError = status === 'failed' || status === 'expired' || error
  const Icon = isSuccess ? CheckCircle2 : isLoading ? Loader2 : isError ? AlertCircle : Clock3
  const accent = isSuccess
    ? 'border-celadon-600/30 bg-celadon-50 text-celadon-700'
    : isError
      ? 'border-verm-500/30 bg-verm-500/10 text-verm-600'
      : 'border-ink-700/10 bg-rice-100 text-ink-700'

  const label = error || STATUS_LABEL[status] || '等待微信确认'

  return (
    <div className={cn('flex items-start gap-2.5 rounded-xl border px-3 py-2.5', accent)}>
      <Icon size={14} className={cn('mt-0.5 shrink-0', isLoading && 'animate-spin')} />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium break-words">{label}</p>
      </div>
    </div>
  )
}

export default WechatQrPanel
