'use client'

import { ArrowRight, ShieldCheck } from 'lucide-react'
import { buildCasdoorOauthStartUrl } from '@/lib/api'
import { cn } from '@/lib/utils'

export function CasdoorUnifiedPanel({ nextUrl = '/image' }) {
  const onStart = () => {
    window.location.href = buildCasdoorOauthStartUrl({ next: nextUrl, popup: false, format: 'redirect' })
  }

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={onStart}
        className={cn(
          'group flex w-full min-h-[48px] items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold text-white transition-all tap-transparent',
          'bg-gradient-to-br from-celadon-600 to-celadon-500',
          'shadow-[var(--shadow-ink)] hover:brightness-105 active:scale-[0.98]'
        )}
      >
        <ShieldCheck size={16} />
        <span>使用统一账号登录</span>
        <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
      </button>

      <div className="rounded-2xl border border-ink-700/10 bg-rice-100 p-3 text-[11px] leading-relaxed text-ink-500">
        登录与权限由 Casdoor 统一管理，算力点和业务数据继续保存在万模 AI 本地账户中。
      </div>
    </div>
  )
}

export default CasdoorUnifiedPanel
