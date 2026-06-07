'use client'

import Link from 'next/link'
import { ArrowLeft, ShieldCheck } from 'lucide-react'
import { buildCasdoorOauthStartUrl } from '@/lib/api'

export default function AdminLoginPage() {
  function startCasdoorAdminLogin() {
    window.location.href = buildCasdoorOauthStartUrl({ next: '/admin', popup: false, format: 'redirect' })
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
            <div className="mx-auto w-full max-w-sm space-y-3">
              <div className="mb-6">
                <h2 className="font-serif text-2xl font-semibold text-ink-900">统一账号</h2>
                <p className="mt-1 text-xs text-ink-500">请使用 Casdoor 授权进入后台</p>
              </div>

              <button
                type="button"
                onClick={startCasdoorAdminLogin}
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-celadon-600 to-celadon-500 px-5 py-3 text-sm font-semibold text-rice-50 shadow-[var(--shadow-ink)] transition hover:brightness-105 active:scale-[0.98]"
              >
                <ShieldCheck size={15} />
                使用统一账号进入司理处
              </button>
              <p className="pt-1 text-center text-[10px] text-ink-400">操作将记入审计 · IP 与设备同时入档</p>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
