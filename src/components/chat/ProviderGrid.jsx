'use client'

import { ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'

export function ProviderGrid({ providers, onSelect, loading }) {
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:gap-3 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4">
      {providers.map((p) => {
        const count = p.models?.length || 0
        const model = p.models?.[0]
        const isDeepseek = p.id === 'deepseek'
        const disabled = loading || count === 0
        return (
          <button
            key={p.id}
            onClick={() => onSelect(p)}
            disabled={disabled}
            className={cn(
              'group relative flex flex-col overflow-hidden rounded-2xl border border-white/5 bg-slate-900/35 p-3.5 text-left transition-all duration-300 backdrop-blur-xl tap-transparent active:scale-[0.98]',
              'hover:-translate-y-1 hover:border-white/10 hover:bg-slate-950/60 hover:shadow-[0_8px_30px_var(--hover-glow)]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/40',
              'sm:p-5',
              disabled && 'opacity-50 hover:translate-y-0 cursor-not-allowed'
            )}
            style={{
              '--hover-glow': p.color ? `${p.color}25` : 'rgba(99,102,241,0.15)'
            }}
          >
            <div
              className="absolute -right-10 -top-10 h-28 w-28 rounded-full opacity-15 blur-3xl transition-all duration-300 group-hover:opacity-40 group-hover:scale-110"
              style={{ background: p.color }}
            />

            <div className="relative flex items-center justify-between gap-2">
              <div
                className={cn(
                  'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 shadow-inner sm:h-11 sm:w-11',
                  isDeepseek ? 'bg-white' : ''
                )}
                style={!isDeepseek ? { backgroundColor: `${p.color}1F` } : undefined}
              >
                {p.logo ? (
                  <img
                    src={p.logo}
                    alt={p.name}
                    className="h-5 w-5 object-contain sm:h-6 sm:w-6"
                  />
                ) : (
                  <span
                    className="text-base font-bold sm:text-lg"
                    style={{ color: p.color }}
                  >
                    {p.initial}
                  </span>
                )}
              </div>
              {count > 0 ? (
                <span className="shrink-0 rounded-full border border-white/8 bg-white/5 px-2 py-0.5 text-[10px] font-mono text-slate-300">
                  默认
                </span>
              ) : (
                <span className="shrink-0 rounded-full border border-amber-400/20 bg-amber-500/10 px-2 py-0.5 text-[9px] text-amber-300">
                  无
                </span>
              )}
            </div>

            <h3 className="relative mt-3 text-sm font-semibold text-white sm:mt-4 sm:text-base">
              {p.name}
            </h3>
            <p className="relative mt-1 line-clamp-2 text-[11px] text-slate-400 leading-relaxed sm:text-xs">
              {model?.name || p.description}
            </p>

            <div className="relative mt-3 flex items-center justify-between text-[10px] sm:text-[11px]">
              <span className="text-slate-500">
                {count > 0 ? '点击开始对话' : '暂未配置'}
              </span>
              <ArrowRight
                size={13}
                className="text-slate-600 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-300"
              />
            </div>
          </button>
        )
      })}
    </div>
  )
}

export default ProviderGrid
