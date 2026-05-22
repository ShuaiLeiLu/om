'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, CalendarClock, Coins, History, LogOut, RefreshCw, ShieldCheck, Sparkles } from 'lucide-react'
import { fetchMe, fetchQuotaLedger, fetchQuotaSummary, logout } from '@/lib/api'
import { useAuthStore } from '@/store/useStore'
import { cn } from '@/lib/utils'

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
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-50 sm:px-6 lg:px-8 bg-dot-grid relative overflow-hidden">
      {/* Background glow orbits */}
      <div className="absolute top-[-10%] left-[-10%] h-[50%] w-[50%] rounded-full bg-indigo-500/10 blur-[120px] pointer-events-none animate-orbit-1" />
      <div className="absolute bottom-[-10%] right-[-10%] h-[50%] w-[50%] rounded-full bg-fuchsia-500/10 blur-[120px] pointer-events-none animate-orbit-2" />

      <div className="relative z-10 mx-auto max-w-4xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/image"
            className="inline-flex items-center gap-2 rounded-full border border-white/5 bg-white/[0.02] px-4 py-2 text-xs font-semibold text-slate-300 transition-all duration-300 hover:bg-white/[0.08] hover:text-white hover:scale-105 active:scale-95 shadow-[0_4px_12px_rgba(0,0,0,0.1)]"
          >
            <ArrowLeft size={14} />
            返回客户端
          </Link>
          <div className="flex items-center gap-2">
            <button
              onClick={refresh}
              className="inline-flex h-9 items-center gap-1.5 rounded-full border border-white/5 bg-white/[0.02] px-4 text-xs font-semibold text-slate-300 transition-all duration-300 hover:bg-white/[0.08] hover:text-white hover:scale-105 active:scale-95 shadow-[0_4px_12px_rgba(0,0,0,0.1)]"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              刷新
            </button>
            <button
              onClick={handleLogout}
              className="inline-flex h-9 items-center gap-1.5 rounded-full border border-rose-500/20 bg-rose-500/5 px-4 text-xs font-semibold text-rose-300 transition-all duration-300 hover:bg-rose-500/15 hover:text-rose-200 hover:scale-105 active:scale-95"
            >
              <LogOut size={13} />
              退出登录
            </button>
          </div>
        </div>

        <section className="relative overflow-hidden rounded-3xl border border-white/5 bg-slate-900/15 p-6 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.25)]">
          <div className="grid gap-6 md:grid-cols-[1.1fr_0.9fr]">
            <div className="flex flex-col justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-fuchsia-500 text-xl font-bold text-white shadow-[0_4px_12px_rgba(139,92,246,0.3)]">
                  {(user?.displayName || '微').slice(0, 1)}
                </div>
                <div className="min-w-0">
                  <h1 className="truncate text-xl font-bold text-white tracking-tight">{user?.displayName || '微信用户'}</h1>
                  <p className="mt-1 truncate text-[10px] font-mono text-slate-500">ID: {user?.id || '正在同步...'}</p>
                </div>
              </div>

              {/* 3D gradient asset card */}
              <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-indigo-600 via-purple-600 to-fuchsia-600 p-5 text-white shadow-[0_12px_30px_rgba(99,102,241,0.25)] min-h-[160px] flex flex-col justify-between group">
                <div className="absolute inset-0 bg-dot-grid opacity-20 pointer-events-none" />
                <div className="absolute -right-8 -bottom-8 h-32 w-32 bg-white/10 rounded-full blur-2xl pointer-events-none transition-transform duration-500 group-hover:scale-110" />
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Coins size={18} className="text-amber-300 animate-pulse" />
                    <span className="text-[10px] uppercase tracking-widest font-bold text-white/80">Compute Asset Card</span>
                  </div>
                  <span className="text-[9px] font-mono tracking-widest text-indigo-200">PREMIUM PLATINUM</span>
                </div>

                <div className="my-3">
                  <span className="text-[9px] text-white/60 block uppercase tracking-wider font-semibold">Available Balance</span>
                  <span className="text-3xl font-bold tracking-tight text-white font-mono drop-shadow-[0_2px_4px_rgba(0,0,0,0.2)]">{balance}</span>
                </div>

                <div className="flex items-end justify-between text-[9px] font-mono">
                  <div>
                    <span className="text-[8px] text-white/50 block uppercase tracking-wider font-semibold">Holder ID</span>
                    <span className="text-white/80 max-w-[150px] truncate block">{user?.id || 'SYNCING...'}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[8px] text-white/50 block uppercase tracking-wider font-semibold">Expiring (7d)</span>
                    <span className="text-amber-300 font-bold">{expiringSoon}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/5 bg-slate-950/20 p-5 backdrop-blur-md flex flex-col justify-between">
              <div>
                <h2 className="text-xs font-bold text-white flex items-center gap-1.5 mb-4">
                  <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
                  账号状态与规则
                </h2>
                <div className="space-y-3">
                  <div className="flex items-start gap-3 rounded-xl border border-emerald-500/15 bg-emerald-500/10 p-3.5 text-xs text-emerald-200/90">
                    <ShieldCheck size={16} className="mt-0.5 shrink-0 text-emerald-400" />
                    <div>
                      <p className="font-semibold text-emerald-200">微信身份已绑定</p>
                      <p className="mt-1 leading-relaxed text-emerald-300/60">客户端扫码登录、小程序同步，都归集到同一个后端用户。</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 rounded-xl border border-white/5 bg-white/[0.015] p-3.5 text-xs text-slate-300">
                    <Sparkles size={16} className="mt-0.5 shrink-0 text-indigo-400" />
                    <div>
                      <p className="font-semibold text-slate-200">数据以后端账本为准</p>
                      <p className="mt-1 leading-relaxed text-slate-500">模型消耗、奖励、管理员手动调整均以服务端流水为依据。</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-3xl border border-white/5 bg-slate-900/15 p-6 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.25)]">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History size={16} className="text-slate-400" />
              <h2 className="text-sm font-bold text-white">算力点流水</h2>
            </div>
            <span className="text-xs text-slate-500 font-medium">最近 30 条</span>
          </div>

          {error ? (
            <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-xs text-rose-300">{error}</div>
          ) : loading ? (
            <div className="py-12 text-center text-xs text-slate-500 flex flex-col items-center gap-2">
              <RefreshCw size={18} className="animate-spin text-indigo-400" />
              正在拉取账单流水...
            </div>
          ) : ledger.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-500">暂无算力点流水</div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-white/5 bg-slate-950/20">
              {ledger.map((item) => {
                const isPositive = Number(item.deltaTokens || 0) >= 0
                return (
                  <div key={item.id} className="grid gap-3 border-b border-white/5 px-4 py-3.5 last:border-b-0 sm:grid-cols-[1fr_auto_auto] sm:items-center transition-colors duration-200 hover:bg-white/[0.015]">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-slate-200">{ledgerTitle(item.type)}</p>
                      <p className="mt-0.5 truncate text-[10.5px] text-slate-500 font-medium">{item.remark || item.relatedId || '系统记录'}</p>
                    </div>
                    <p className={cn(
                      'text-sm font-mono font-bold leading-none',
                      isPositive ? 'text-emerald-400' : 'text-rose-400'
                    )}>
                      {isPositive ? '+' : ''}{formatToken(item.deltaTokens)}
                    </p>
                    <p className="text-[10px] font-medium text-slate-500 sm:text-right">{formatDate(item.createdAt)}</p>
                  </div>
                )
              })}
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
  return map[type] || type || '算力点变动'
}
