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
import { createWechatLoginSession, fetchMe, fetchQuotaSummary, fetchWechatLoginSession } from '@/lib/api'
import { useAuthStore } from '@/store/useStore'
import { cn } from '@/lib/utils'

const STATUS_LABEL = {
  pending: '请使用微信扫码',
  scanned: '已扫码，请在小程序中确认',
  confirmed: '登录成功，正在进入个人中心',
  expired: '二维码已过期，请刷新',
  cancelled: '登录已取消，请刷新',
  failed: '登录失败，请刷新'
}

// 微信小程序扫码登录面板（保留原有流程）。
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

  useEffect(() => {
    if (!session?.sessionId) return
    if (status === 'confirmed' || status === 'expired' || status === 'failed') return

    let stopped = false
    const timer = window.setInterval(async () => {
      try {
        const next = await fetchWechatLoginSession(session.sessionId)
        if (stopped) return
        setStatus(next.status)
        if (next.status === 'confirmed') {
          window.clearInterval(timer)
          const [user, quota] = await Promise.all([fetchMe(), fetchQuotaSummary()])
          setSession({ user, quota })
          router.replace(nextUrl)
        }
      } catch (err) {
        if (stopped) return
        setStatus('failed')
        setError(err.message || '登录状态同步失败')
      }
    }, 1800)

    return () => {
      stopped = true
      window.clearInterval(timer)
    }
  }, [router, session, setSession, status, nextUrl])

  const isLoading = status === 'loading'
  const isFailed = status === 'failed' || status === 'expired'
  const isSuccess = status === 'confirmed'

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-200">
            <ScanLine size={12} className="text-fuchsia-300" />
            微信扫码登录
          </p>
          <p className="mt-0.5 text-[10px] text-slate-500">二维码 5 分钟内有效</p>
        </div>
        <button
          onClick={startLogin}
          disabled={isLoading}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/8 bg-white/[0.03] text-slate-300 transition hover:bg-white/[0.06] hover:text-white disabled:opacity-50 tap-transparent"
          aria-label="刷新二维码"
        >
          <RefreshCw size={13} className={cn(isLoading && 'animate-spin')} />
        </button>
      </div>

      <div className="relative mx-auto aspect-square w-full max-w-[260px] overflow-hidden rounded-2xl border border-white/10 bg-white p-3">
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
          <div className="flex h-full w-full items-center justify-center rounded-xl bg-slate-100">
            {isFailed ? (
              <QrCode className="text-slate-400" size={48} strokeWidth={1.5} />
            ) : (
              <Loader2 size={34} className="animate-spin text-slate-400" />
            )}
          </div>
        )}

        {isSuccess && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-emerald-500/10 backdrop-blur-sm">
            <CheckCircle2 size={36} className="text-emerald-500" />
            <p className="text-sm font-semibold text-emerald-700">登录成功</p>
          </div>
        )}
      </div>

      <StatusBanner status={status} error={error} />

      <div className="flex items-start gap-2.5 rounded-xl border border-white/8 bg-white/[0.02] px-3 py-2.5 text-[10px] text-slate-400">
        <Smartphone size={13} className="mt-0.5 shrink-0 text-slate-500" />
        <span className="leading-relaxed">
          手机微信扫码后会自动跳到「万模AI」小程序，确认登录后网页会自动跳转
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
    ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200'
    : isError
      ? 'border-rose-400/30 bg-rose-500/10 text-rose-200'
      : 'border-white/8 bg-white/[0.02] text-slate-200'

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
