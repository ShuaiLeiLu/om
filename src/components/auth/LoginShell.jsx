'use client'

import Link from 'next/link'
import { ArrowLeft, ShieldCheck, Sparkles } from 'lucide-react'

// Page-level layout for the login flow.
// Two-column on desktop (marketing left, login form right), single column on mobile.
export function LoginShell({ children, backHref = '/' }) {
  return (
    <main className="relative min-h-screen-dvh text-slate-50 pl-safe pr-safe bg-slate-950 overflow-x-hidden flex items-center justify-center">
      {/* Neon Orbit Backgrounds & Dot Grid */}
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] h-[500px] w-[500px] rounded-full bg-indigo-500/10 blur-[120px] animate-orbit-1" />
        <div className="absolute bottom-[-10%] right-[-10%] h-[600px] w-[600px] rounded-full bg-fuchsia-500/8 blur-[130px] animate-orbit-2" />
        <div className="absolute inset-0 bg-dot-grid opacity-30" />
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
        <header className="flex items-center justify-between">
          <Link
            href={backHref}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-white/8 bg-white/[0.03] px-3.5 py-2 text-xs font-medium text-slate-300 transition-all duration-300 hover:bg-white/[0.08] hover:border-white/15 hover:text-white active:scale-[0.98] tap-transparent"
          >
            <ArrowLeft size={13} />
            返回首页
          </Link>
          <div className="hidden items-center gap-1.5 rounded-full border border-white/8 bg-white/[0.04] px-3.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-300 backdrop-blur-xl sm:inline-flex shadow-[0_0_15px_rgba(255,255,255,0.02)]">
            <ShieldCheck size={12} className="text-emerald-400" />
            微信安全登录
          </div>
        </header>

        <section className="grid flex-1 items-center gap-8 py-8 lg:grid-cols-[1fr_minmax(0,420px)] lg:gap-16 lg:py-16">
          {children}
        </section>

        <footer className="pt-6 pb-safe text-center text-[10px] text-slate-500 tracking-wide">
          继续即表示你同意万模 AI 服务条款与隐私协议
        </footer>
      </div>
    </main>
  )
}

export function LoginMarketing({ inAuthFlow = false }) {
  return (
    <div className={inAuthFlow ? 'hidden lg:block' : 'block'}>
      <div className="mb-6 inline-flex items-center gap-1.5 rounded-full border border-indigo-400/20 bg-indigo-500/10 px-3.5 py-1 text-[11px] font-semibold text-indigo-300 backdrop-blur-xl shadow-[0_0_15px_rgba(99,102,241,0.15)]">
        <Sparkles size={11} className="text-indigo-400 animate-pulse" />
        登录即可解锁所有模型与图片工作台
      </div>

      <h1 className="max-w-xl text-3xl font-extrabold leading-tight tracking-tight text-white sm:text-4xl lg:text-5xl">
        <span className="block text-slate-300">欢迎回到</span>
        <span className="text-gradient-brand text-glow-purple">万模 AI</span>
      </h1>

      <p className="mt-4 max-w-md text-sm leading-relaxed text-slate-400">
        统一管理你的算力点与对话历史，跨设备同步。客户端与小程序使用同一个微信身份。
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <FeaturePill icon="⚡" title="一键登录" description="微信扫码 / 一键授权" />
        <FeaturePill icon="🔒" title="安全可信" description="OAuth 标准 + Cookie 会话" />
        <FeaturePill icon="🖼️" title="图片工作台" description="文本生图 + 参考图编辑" />
        <FeaturePill icon="💎" title="算力点同步" description="客户端与小程序共享额度" />
      </div>
    </div>
  )
}

function FeaturePill({ icon, title, description }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/6 bg-white/[0.02] px-4 py-3.5 backdrop-blur-xl transition-all duration-300 hover:scale-[1.02] hover:bg-white/[0.05] hover:border-white/12 hover:shadow-[0_8px_20px_rgba(0,0,0,0.2)]">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500/20 to-fuchsia-500/15 text-lg shadow-[0_0_12px_rgba(99,102,241,0.15)]">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-slate-100">{title}</p>
        <p className="mt-0.5 truncate text-[10px] text-slate-400">{description}</p>
      </div>
    </div>
  )
}

export default LoginShell

