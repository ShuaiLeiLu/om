'use client'

import Link from 'next/link'
import { ArrowLeft, ShieldCheck, Sparkles } from 'lucide-react'

// Page-level layout for the login flow.
// Two-column on desktop (marketing left, login form right), single column on mobile.
export function LoginShell({ children, backHref = '/' }) {
  return (
    <main className="relative min-h-screen-dvh text-slate-50 pl-safe pr-safe">
      <div className="mx-auto flex min-h-screen-dvh max-w-6xl flex-col px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
        <header className="flex items-center justify-between">
          <Link
            href={backHref}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2 text-sm text-slate-300 transition hover:bg-white/[0.06] hover:text-white tap-transparent"
          >
            <ArrowLeft size={14} />
            返回首页
          </Link>
          <div className="hidden items-center gap-1.5 rounded-full border border-white/8 bg-white/[0.04] px-3 py-1.5 text-[11px] font-medium text-slate-300 sm:inline-flex">
            <ShieldCheck size={12} className="text-emerald-300" />
            微信安全登录
          </div>
        </header>

        <section className="grid flex-1 items-center gap-8 py-6 lg:grid-cols-[1fr_minmax(0,420px)] lg:gap-12 lg:py-12">
          {children}
        </section>

        <footer className="pt-4 pb-safe text-center text-[10px] text-slate-600">
          继续即表示你同意万模 AI 服务条款与隐私协议
        </footer>
      </div>
    </main>
  )
}

export function LoginMarketing({ inAuthFlow = false }) {
  return (
    <div className={inAuthFlow ? 'hidden lg:block' : 'block'}>
      <div className="mb-5 inline-flex items-center gap-1.5 rounded-full border border-indigo-400/25 bg-indigo-500/10 px-3 py-1 text-[11px] font-medium text-indigo-200">
        <Sparkles size={12} className="text-indigo-300" />
        登录即可解锁所有模型与图片工作台
      </div>

      <h1 className="max-w-xl text-3xl font-bold leading-tight tracking-tight text-white sm:text-4xl lg:text-5xl">
        <span className="block text-slate-300">欢迎回到</span>
        <span className="text-gradient-brand">万模 AI</span>
      </h1>

      <p className="mt-4 max-w-md text-sm leading-relaxed text-slate-400">
        统一管理你的 算力点 与对话历史，跨设备同步。网页与小程序使用同一个微信身份。
      </p>

      <div className="mt-7 grid gap-3 sm:grid-cols-2">
        <FeaturePill icon="⚡" title="一键登录" description="微信扫码 / 一键授权" />
        <FeaturePill icon="🔒" title="安全可信" description="OAuth 标准 + Cookie 会话" />
        <FeaturePill icon="🖼️" title="图片工作台" description="文本生图 + 参考图编辑" />
        <FeaturePill icon="💎" title="算力点 同步" description="网页与小程序共享额度" />
      </div>
    </div>
  )
}

function FeaturePill({ icon, title, description }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 backdrop-blur-xl">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500/20 to-fuchsia-500/15 text-lg">
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
