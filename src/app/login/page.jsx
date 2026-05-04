'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, CheckCircle2, Clock3, Loader2, RefreshCw, ShieldCheck, Smartphone } from 'lucide-react'
import { createWechatLoginSession, fetchMe, fetchQuotaSummary, fetchWechatLoginSession } from '@/lib/api'
import { useAuthStore } from '@/store/useStore'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

function cn(...inputs) {
  return twMerge(clsx(inputs))
}

export default function LoginPage() {
  const router = useRouter()
  const { setSession } = useAuthStore()
  const [session, setLoginSession] = useState(null)
  const [status, setStatus] = useState('loading')
  const [message, setMessage] = useState('正在创建微信登录二维码')
  const [error, setError] = useState('')

  const qrUrl = useMemo(() => {
    if (!session?.qrImageUrl) return ''
    return `${session.qrImageUrl}?t=${encodeURIComponent(session.sessionId)}`
  }, [session])

  useEffect(() => {
    startLogin()
  }, [])

  useEffect(() => {
    if (!session?.sessionId) return
    if (status === 'confirmed' || status === 'expired' || status === 'failed') return

    let stopped = false
    const timer = window.setInterval(async () => {
      try {
        const next = await fetchWechatLoginSession(session.sessionId)
        if (stopped) return
        setStatus(next.status)
        setMessage(statusText(next.status))
        if (next.status === 'confirmed') {
          window.clearInterval(timer)
          const [user, quota] = await Promise.all([fetchMe(), fetchQuotaSummary()])
          setSession({ user, quota })
          router.replace('/profile')
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
  }, [router, session, setSession, status])

  async function startLogin() {
    try {
      setStatus('loading')
      setError('')
      setMessage('正在创建微信登录二维码')
      const next = await createWechatLoginSession()
      setLoginSession(next)
      setStatus('pending')
      setMessage('请使用微信扫码，在小程序中确认登录')
    } catch (err) {
      setStatus('failed')
      setError(err.message || '二维码创建失败')
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-slate-50 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-48px)] max-w-6xl flex-col">
        <div className="flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-slate-400 transition hover:bg-slate-900 hover:text-white">
            <ArrowLeft size={16} />
            返回首页
          </Link>
          <div className="rounded-full border border-slate-800 bg-slate-900/70 px-3 py-1 text-xs font-medium text-slate-400">
            微信安全登录
          </div>
        </div>

        <section className="grid flex-1 items-center gap-8 py-8 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-indigo-500/20 bg-indigo-500/10 px-3 py-1 text-xs font-semibold text-indigo-200">
              <ShieldCheck size={14} />
              后端账号将自动绑定微信身份
            </div>
            <h1 className="max-w-2xl text-4xl font-bold leading-tight tracking-tight text-white md:text-5xl">
              登录万模AI，统一管理你的 Token 和对话权限
            </h1>
            <p className="mt-5 max-w-xl text-sm leading-7 text-slate-400">
              网页端使用微信扫码登录，小程序端通过同一个微信身份领取广告奖励。后端会根据微信 openid/unionid 自动创建或关联账号。
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {[
                ['1', '网页生成二维码'],
                ['2', '微信扫码进入小程序'],
                ['3', '确认后自动登录']
              ].map(([step, label]) => (
                <div key={step} className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500/15 text-xs font-bold text-indigo-300">{step}</div>
                  <p className="mt-3 text-sm font-medium text-slate-200">{label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-2xl shadow-black/30">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h2 className="text-base font-bold text-white">微信扫码登录</h2>
                <p className="mt-1 text-xs text-slate-500">二维码 5 分钟内有效</p>
              </div>
              <button
                onClick={startLogin}
                className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-800 hover:text-white"
                aria-label="刷新二维码"
              >
                <RefreshCw size={16} />
              </button>
            </div>

            <div className="py-8">
              <div className="mx-auto flex aspect-square w-full max-w-[280px] items-center justify-center rounded-2xl border border-slate-800 bg-white p-4">
                {qrUrl && status !== 'loading' && status !== 'failed' ? (
                  <img src={qrUrl} alt="微信扫码登录二维码" className="h-full w-full rounded-xl object-contain" />
                ) : (
                  <Loader2 size={34} className="animate-spin text-slate-400" />
                )}
              </div>
            </div>

            <div className={cn(
              'flex items-start gap-3 rounded-xl border px-4 py-3',
              status === 'confirmed' ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200' : 'border-slate-800 bg-slate-950/60 text-slate-300'
            )}>
              {status === 'confirmed' ? <CheckCircle2 size={18} /> : status === 'loading' ? <Loader2 size={18} className="animate-spin" /> : <Clock3 size={18} />}
              <div className="min-w-0">
                <p className="text-sm font-semibold">{error || message}</p>
                <p className="mt-1 text-xs text-slate-500">请确认小程序已经登录并绑定微信身份。</p>
              </div>
            </div>

            <div className="mt-5 flex items-center gap-3 rounded-xl bg-slate-950/50 px-4 py-3 text-xs text-slate-500">
              <Smartphone size={16} className="shrink-0 text-slate-400" />
              手机微信扫码后，小程序会完成身份确认，网页会自动跳转。
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}

function statusText(status) {
  const map = {
    pending: '请使用微信扫码，在小程序中确认登录',
    scanned: '已扫码，请在小程序中确认',
    confirmed: '登录成功，正在进入个人中心',
    expired: '二维码已过期，请刷新',
    cancelled: '登录已取消，请刷新',
    failed: '登录失败，请刷新'
  }
  return map[status] || '等待微信确认'
}
