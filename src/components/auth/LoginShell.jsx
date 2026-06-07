'use client'

import Link from 'next/link'
import { ArrowLeft, ShieldCheck } from 'lucide-react'

// Page-level layout for the login flow.
// Two-column on desktop (marketing left, login form right), single column on mobile.
export function LoginShell({ children, backHref = '/' }) {
  return (
    <main className="relative min-h-screen-dvh text-ink-900 pl-safe pr-safe bg-rice-100 overflow-x-hidden flex items-center justify-center paper">
      <div className="relative z-10 mx-auto flex w-full max-w-[1180px] flex-col px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
        <header className="flex items-center justify-between">
          <Link
            href={backHref}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-ink-700/10 bg-rice-50 px-3.5 py-2 text-xs font-medium text-ink-600 shadow-[var(--shadow-paper)] transition hover:bg-rice-100 active:scale-[0.98] tap-transparent"
          >
            <ArrowLeft size={13} />
            返回首页
          </Link>
          <div className="hidden items-center gap-1.5 rounded-full border border-celadon-600/15 bg-celadon-50 px-3.5 py-1.5 text-[10px] font-semibold tracking-wider text-celadon-700 sm:inline-flex">
            <ShieldCheck size={12} />
            统一账号登录
          </div>
        </header>

        <section className="grid flex-1 overflow-hidden rounded-[36px] border border-ink-700/10 bg-rice-50 shadow-[var(--shadow-paper-lg)] lg:grid-cols-[1.1fr_1fr]">
          {children}
        </section>

        <footer className="pt-6 pb-safe text-center text-[10px] text-ink-400 tracking-wide">
          继续即表示你同意万模 AI 服务条款与隐私协议
        </footer>
      </div>
    </main>
  )
}

export function LoginMarketing({ inAuthFlow = false }) {
  return (
    <div className={inAuthFlow ? 'hidden lg:block' : 'relative min-h-[360px] overflow-hidden border-b border-ink-700/10 p-8 ricepaper lg:min-h-[640px] lg:border-b-0 lg:border-r lg:p-12'}>
      <svg className="pointer-events-none absolute inset-x-0 bottom-0 w-full opacity-90" viewBox="0 0 600 220" fill="none">
        <path d="M0,180 Q60,110 130,140 T260,120 T390,150 T520,110 T600,140 L600,220 L0,220 Z" fill="#A5CCC4" />
        <path d="M0,200 Q80,150 160,170 T320,160 T480,180 T600,160 L600,220 L0,220 Z" fill="#5BA5A0" />
        <path d="M0,215 Q100,190 200,200 T400,210 T600,200 L600,220 L0,220 Z" fill="#1F6B66" />
      </svg>

      <div className="relative">
        <div className="mb-10 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-celadon-600 to-celadon-500 shadow-[var(--shadow-ink)]">
            <span className="font-serif text-2xl font-bold text-rice-50">万</span>
          </div>
          <div>
            <div className="font-serif text-xl font-semibold">万 模 AI</div>
            <div className="mt-0.5 font-mono text-xs tracking-widest text-ink-500">WANMO · AI</div>
          </div>
        </div>

        <h1 className="relative max-w-xl font-serif text-3xl font-semibold leading-tight tracking-tight text-ink-900 sm:text-4xl lg:text-5xl">
          <span className="block">一念之间</span>
          <span className="brand-mark">万模为我所用</span>
        </h1>

        <p className="relative mt-4 max-w-md text-sm leading-relaxed text-ink-500">
          集合 OpenAI · Gemini · DeepSeek · Kimi · 通义 · Grok 等海内外大模型于一席，随心切换，按需取用。
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-5 text-xs text-ink-500">
          <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-celadon-500" />20+ 模型</span>
          <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-verm-500" />实时画图</span>
          <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-gold-500" />视频得算力点</span>
        </div>

        <div className="seal relative mt-14 flex h-16 w-16 flex-col items-center justify-center text-center">
          <span className="font-serif text-base font-bold leading-tight">万模</span>
          <span className="mt-0.5 text-[10px] tracking-widest">之印</span>
        </div>
      </div>
    </div>
  )
}

export default LoginShell
