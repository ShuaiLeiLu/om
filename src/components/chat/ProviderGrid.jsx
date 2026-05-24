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
              'card group relative flex flex-col overflow-hidden p-3.5 text-left transition-all duration-300 tap-transparent active:scale-[0.98]',
              'hover:-translate-y-1 hover:border-celadon-200 hover:shadow-[var(--shadow-paper-lg)]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-celadon-500/50',
              'sm:p-5',
              disabled && 'opacity-50 hover:translate-y-0 cursor-not-allowed'
            )}
          >
            <div className="relative flex items-center justify-between gap-2">
              <div
                className={cn(
                  'logo-dot shrink-0 border border-ink-700/10 sm:h-11 sm:w-11',
                  isDeepseek ? 'bg-white' : ''
                )}
                style={!isDeepseek ? { background: p.color } : undefined}
              >
                {p.logo ? (
                  <img
                    src={p.logo}
                    alt={p.name}
                    className="h-5 w-5 object-contain sm:h-6 sm:w-6"
                  />
                ) : (
                  <span className="text-[11px] font-bold text-rice-50 sm:text-xs">
                    {p.initial}
                  </span>
                )}
              </div>
              {count > 0 ? (
                <span className="shrink-0 rounded-full border border-celadon-600/15 bg-celadon-50 px-2 py-0.5 text-[10px] font-mono text-celadon-700">
                  默认
                </span>
              ) : (
                <span className="shrink-0 rounded-full border border-gold-500/25 bg-gold-500/10 px-2 py-0.5 text-[9px] text-gold-600">
                  无
                </span>
              )}
            </div>

            <h3 className="relative mt-3 text-sm font-semibold text-ink-900 sm:mt-4 sm:text-base">
              {p.name}
            </h3>
            <p className="relative mt-1 line-clamp-2 text-[11px] text-ink-500 leading-relaxed sm:text-xs">
              {model?.name || p.description}
            </p>

            <div className="relative mt-3 flex items-center justify-between text-[10px] sm:text-[11px]">
              <span className="text-ink-500">
                {count > 0 ? '点击开始对话' : '暂未配置'}
              </span>
              <ArrowRight
                size={13}
                className="text-ink-400 transition-transform group-hover:translate-x-0.5 group-hover:text-celadon-700"
              />
            </div>
          </button>
        )
      })}
    </div>
  )
}

export default ProviderGrid
