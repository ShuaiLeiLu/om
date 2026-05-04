'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Loader2, LockKeyhole, ShieldCheck } from 'lucide-react'
import { adminLogin, fetchAdminMe } from '@/lib/api'

export default function AdminLoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    fetchAdminMe()
      .then(() => {
        if (!cancelled) router.replace('/admin')
      })
      .catch(() => null)
      .finally(() => {
        if (!cancelled) setChecking(false)
      })
    return () => {
      cancelled = true
    }
  }, [router])

  async function handleSubmit(event) {
    event.preventDefault()
    if (!username.trim() || !password) {
      setError('请输入账号和密码')
      return
    }
    try {
      setLoading(true)
      setError('')
      await adminLogin({ username: username.trim(), password })
      router.replace('/admin')
    } catch (err) {
      setError(err.message || '登录失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-slate-50 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-48px)] max-w-6xl flex-col">
        <div className="flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-400 transition hover:bg-slate-900 hover:text-white">
            <ArrowLeft size={16} />
            返回首页
          </Link>
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900/70 px-3 py-1 text-xs font-medium text-slate-400">
            <ShieldCheck size={13} />
            管理员后台
          </div>
        </div>

        <section className="grid flex-1 items-center gap-8 py-8 lg:grid-cols-[1fr_420px]">
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-100">
              <LockKeyhole size={14} />
              账号密码独立于普通用户微信登录
            </div>
            <h1 className="max-w-2xl text-4xl font-bold leading-tight tracking-tight text-white md:text-5xl">
              万模AI 管理后台
            </h1>
            <p className="mt-5 max-w-xl text-sm leading-7 text-slate-400">
              管理用户额度、模型开关、兑换码、广告奖励和运营审计。管理员会话使用独立 Cookie，不与普通用户登录态混用。
            </p>
          </div>

          <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-2xl shadow-black/30">
            <div className="border-b border-slate-800 pb-4">
              <h2 className="text-base font-bold text-white">管理员登录</h2>
              <p className="mt-1 text-xs text-slate-500">默认账号由后端 seed 或环境变量创建</p>
            </div>

            <div className="space-y-4 py-5">
              <label className="block">
                <span className="text-xs font-semibold text-slate-400">账号 / 邮箱</span>
                <input
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  className="mt-2 h-11 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-500"
                  placeholder="admin"
                  autoComplete="username"
                  disabled={checking || loading}
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-slate-400">密码</span>
                <input
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="mt-2 h-11 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-500"
                  placeholder="admin@123"
                  type="password"
                  autoComplete="current-password"
                  disabled={checking || loading}
                />
              </label>
            </div>

            {error && (
              <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={checking || loading}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-cyan-500 px-4 text-sm font-bold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {(checking || loading) && <Loader2 size={16} className="animate-spin" />}
              {checking ? '检查登录状态' : '登录后台'}
            </button>
          </form>
        </section>
      </div>
    </main>
  )
}
