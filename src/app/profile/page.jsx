'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, CalendarClock, Coins, History, LogOut, RefreshCw, ShieldCheck, Sparkles } from 'lucide-react'
import { fetchMe, fetchQuotaLedger, fetchQuotaSummary, logout } from '@/lib/api'
import { useAuthStore } from '@/store/useStore'

export default function ProfilePage() {
  const router = useRouter()
  const { user, quota, setSession, clearSession } = useAuthStore()
  const [ledger, setLedger] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    refresh()
  }, [])

  const balance = useMemo(() => formatToken(quota?.tokenBalance || 0), [quota])
  const expiringSoon = useMemo(() => formatToken(quota?.expiringSoonTokens || 0), [quota])

  async function refresh() {
    try {
      setLoading(true)
      setError('')
      const [nextUser, nextQuota, nextLedger] = await Promise.all([
        fetchMe(),
        fetchQuotaSummary(),
        fetchQuotaLedger({ pageSize: 30 })
      ])
      setSession({ user: nextUser, quota: nextQuota })
      setLedger(nextLedger)
    } catch (err) {
      if (String(err.message || '').includes('请先登录')) {
        clearSession()
        router.replace('/login')
        return
      }
      setError(err.message || '个人中心加载失败')
    } finally {
      setLoading(false)
    }
  }

  async function handleLogout() {
    await logout().catch(() => null)
    clearSession()
    router.replace('/login')
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-slate-50 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <Link href="/image" className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-slate-400 transition hover:bg-slate-900 hover:text-white">
            <ArrowLeft size={16} />
            返回生图
          </Link>
          <div className="flex items-center gap-2">
            <button onClick={refresh} className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-800 px-3 text-sm text-slate-300 transition hover:bg-slate-900 hover:text-white">
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
              刷新
            </button>
            <button onClick={handleLogout} className="inline-flex h-10 items-center gap-2 rounded-xl border border-red-500/20 px-3 text-sm text-red-200 transition hover:bg-red-500/10">
              <LogOut size={15} />
              退出
            </button>
          </div>
        </div>

        <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/70">
          <div className="grid gap-0 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="border-b border-slate-800 p-6 lg:border-b-0 lg:border-r">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-500/15 text-xl font-bold text-indigo-200">
                  {(user?.displayName || '微').slice(0, 1)}
                </div>
                <div className="min-w-0">
                  <h1 className="truncate text-2xl font-bold text-white">{user?.displayName || '微信用户'}</h1>
                  <p className="mt-1 truncate text-xs text-slate-500">用户 ID：{user?.id || '正在同步'}</p>
                </div>
              </div>

              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
                    <Coins size={15} className="text-indigo-300" />
                    当前 Token
                  </div>
                  <p className="mt-3 text-3xl font-bold tracking-tight text-white">{balance}</p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
                    <CalendarClock size={15} className="text-amber-300" />
                    7 天内到期
                  </div>
                  <p className="mt-3 text-3xl font-bold tracking-tight text-white">{expiringSoon}</p>
                </div>
              </div>
            </div>

            <div className="p-6">
              <h2 className="text-sm font-bold text-white">账号绑定状态</h2>
              <div className="mt-4 space-y-3">
                <div className="flex items-start gap-3 rounded-xl border border-emerald-500/15 bg-emerald-500/10 p-4 text-sm text-emerald-100">
                  <ShieldCheck size={18} className="mt-0.5 shrink-0" />
                  <div>
                    <p className="font-semibold">微信身份已绑定</p>
                    <p className="mt-1 text-xs leading-5 text-emerald-100/70">网页扫码登录、小程序看广告领取 Token，会归集到同一个后端用户。</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-950/50 p-4 text-sm text-slate-300">
                  <Sparkles size={18} className="mt-0.5 shrink-0 text-indigo-300" />
                  <div>
                    <p className="font-semibold">Token 以后端账本为准</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">模型消耗、广告奖励、管理员调整都会写入服务端流水。</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History size={18} className="text-slate-400" />
              <h2 className="text-sm font-bold text-white">Token 流水</h2>
            </div>
            <span className="text-xs text-slate-500">最近 30 条</span>
          </div>

          {error ? (
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>
          ) : loading ? (
            <div className="py-12 text-center text-sm text-slate-500">正在同步个人中心...</div>
          ) : ledger.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-500">暂无 Token 流水</div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-800">
              {ledger.map((item) => (
                <div key={item.id} className="grid gap-3 border-b border-slate-800 px-4 py-3 last:border-b-0 sm:grid-cols-[1fr_auto_auto] sm:items-center">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-200">{ledgerTitle(item.type)}</p>
                    <p className="mt-1 truncate text-xs text-slate-500">{item.remark || item.relatedId || '系统记录'}</p>
                  </div>
                  <p className={Number(item.deltaTokens || 0) >= 0 ? 'text-sm font-bold text-emerald-300' : 'text-sm font-bold text-red-300'}>
                    {Number(item.deltaTokens || 0) >= 0 ? '+' : ''}{formatToken(item.deltaTokens)}
                  </p>
                  <p className="text-xs text-slate-500">{formatDate(item.createdAt)}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}

function formatToken(value) {
  const numberValue = Number(value || 0)
  if (!Number.isFinite(numberValue)) return String(value || 0)
  return numberValue.toLocaleString('en-US')
}

function formatDate(value) {
  if (!value) return ''
  return new Date(value).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function ledgerTitle(type) {
  const map = {
    ad_reward: '广告奖励',
    model_usage: '模型消耗',
    redeem: '兑换到账',
    admin_adjust: '后台调整'
  }
  return map[type] || type || 'Token 变动'
}
