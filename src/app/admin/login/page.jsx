'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, KeyRound, Loader2 } from 'lucide-react'
import { adminLogin } from '@/lib/api'
import { cn } from '@/lib/utils'

export default function AdminLoginPage() {
  const router = useRouter()
  const [form, setForm] = useState({ username: '', password: '', code: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const canSubmit = form.username.trim() && form.password.trim()

  async function onSubmit(e) {
    e.preventDefault()
    if (!canSubmit || loading) return
    try {
      setLoading(true)
      setError('')
      await adminLogin({
        username: form.username.trim(),
        password: form.password
      })
      router.replace('/admin')
    } catch (err) {
      setError(err?.message || '司理凭证校验失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-rice-100 text-ink-900 paper pl-safe pr-safe">
      <div className="mx-auto flex min-h-screen max-w-[1180px] flex-col px-4 py-5 sm:px-6">
        <header className="mb-5 flex items-center justify-between">
          <Link
            href="/login?next=/admin"
            className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-ink-700/10 bg-rice-50 px-3.5 py-2 text-xs font-medium text-ink-600 shadow-[var(--shadow-paper)] transition hover:bg-rice-100"
          >
            <ArrowLeft size={13} />
            返回通用登录
          </Link>
          <span className="chip"><span className="h-1.5 w-1.5 rounded-full bg-celadon-500" /> 审计入档</span>
        </header>

        <section className="grid flex-1 overflow-hidden rounded-[36px] border border-ink-700/10 bg-rice-50 shadow-[var(--shadow-paper-lg)] lg:grid-cols-2">
          <div className="relative min-h-[360px] overflow-hidden border-b border-ink-700/10 p-8 ricepaper lg:min-h-[560px] lg:border-b-0 lg:border-r lg:p-12">
            <div className="seal absolute left-8 top-8 flex h-20 w-20 flex-col items-center justify-center bg-celadon-600 text-center text-rice-50 shadow-[var(--shadow-ink)]">
              <span className="font-serif text-base font-bold">司理</span>
              <span className="mt-1 text-[10px] tracking-widest">之 印</span>
            </div>
            <svg className="pointer-events-none absolute inset-x-0 bottom-0 w-full opacity-80" viewBox="0 0 600 220" fill="none">
              <path d="M0,180 Q60,116 130,142 T260,122 T390,150 T520,112 T600,140 L600,220 L0,220 Z" fill="#A5CCC4" />
              <path d="M0,200 Q80,150 160,170 T320,160 T480,180 T600,160 L600,220 L0,220 Z" fill="#5BA5A0" />
              <path d="M0,215 Q100,190 200,200 T400,210 T600,200 L600,220 L0,220 Z" fill="#1F6B66" />
            </svg>
            <div className="absolute bottom-12 left-8 right-8 max-w-sm lg:left-12">
              <p className="label-zh text-xs text-celadon-700">司 理 处 · ADMIN</p>
              <h1 className="mt-2 font-serif text-3xl font-semibold leading-tight text-ink-900">
                掌账册 · 阅货殖<br />权 衡 万 物 之 算
              </h1>
              <p className="mt-3 text-xs leading-relaxed text-ink-500">
                本处仅限授权人员进入。所有操作均记入审计卷宗。
              </p>
            </div>
          </div>

          <div className="flex items-center bg-rice-50 p-8 lg:p-12">
            <form onSubmit={onSubmit} className="mx-auto w-full max-w-sm space-y-3">
              <div className="mb-6">
                <h2 className="font-serif text-2xl font-semibold text-ink-900">司理凭证</h2>
                <p className="mt-1 text-xs text-ink-500">请输入您的管理员凭证</p>
              </div>

              <AdminField
                label="司 理 账 号"
                value={form.username}
                onChange={(value) => setForm((prev) => ({ ...prev, username: value }))}
                placeholder="admin@wanmo.ai"
                autoComplete="username"
              />
              <AdminField
                label="密 钥"
                type="password"
                value={form.password}
                onChange={(value) => setForm((prev) => ({ ...prev, password: value }))}
                placeholder="请输入密钥"
                autoComplete="current-password"
              />
              <AdminField
                label="二 次 验 证 · 6 位"
                value={form.code}
                onChange={(value) => setForm((prev) => ({ ...prev, code: value }))}
                placeholder="暂未启用"
                inputClassName="tracking-[0.3em]"
              />

              {error && (
                <div className="rounded-xl border border-verm-500/25 bg-verm-500/10 px-3 py-2 text-xs text-verm-600">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={!canSubmit || loading}
                className={cn(
                  'mt-2 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-celadon-600 to-celadon-500 px-5 py-3 text-sm font-semibold text-rice-50 shadow-[var(--shadow-ink)] transition hover:brightness-105 active:scale-[0.98]',
                  (!canSubmit || loading) && 'pointer-events-none opacity-50'
                )}
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <KeyRound size={15} />}
                进 入 司 理 处
              </button>
              <p className="pt-1 text-center text-[10px] text-ink-400">操作将记入审计 · IP 与设备同时入档</p>
            </form>
          </div>
        </section>
      </div>
    </main>
  )
}

function AdminField({ label, value, onChange, type = 'text', placeholder, autoComplete, inputClassName }) {
  return (
    <label className="block rounded-xl border border-ink-700/10 bg-rice-50 px-4 py-3 transition focus-within:border-celadon-500/45 focus-within:bg-white">
      <span className="label-zh text-[10px] text-ink-500">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className={cn('mt-1 w-full bg-transparent text-base text-ink-900 outline-none placeholder:text-ink-400 sm:text-sm', inputClassName)}
      />
    </label>
  )
}
