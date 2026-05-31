'use client'

import { ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'

export function ProviderGrid({ providers, onSelect, loading }) {
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:gap-3 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4">
      {providers.map((p) => {
        const count = p.models?.length || 0
        const model = p.models?.[0]
        const isFlagship = p.id === 'openai' || p.id === 'deepseek' || String(model?.name).toLowerCase().includes('gpt-4') || String(model?.name).toLowerCase().includes('gpt-5')
        const disabled = loading || count === 0

        // Custom badges and pricing per design spec
        let badgeText = '对话'
        let badgeClass = 'chip-ink text-[10px] py-0.5 px-2'

        if (p.id === 'openai') {
          badgeText = '旗舰'
          badgeClass = 'chip-verm text-[10px] py-0.5 px-2'
        } else if (p.id === 'deepseek') {
          badgeText = '推理'
          badgeClass = 'chip text-[10px] py-0.5 px-2'
        } else if (p.id === 'qwen') {
          badgeText = '热门'
          badgeClass = 'chip-gold text-[10px] py-0.5 px-2'
        } else if (p.id === 'zhipu') {
          badgeText = '长文'
          badgeClass = 'chip text-[10px] py-0.5 px-2'
        } else if (p.id === 'moonshot') {
          badgeText = '200万'
          badgeClass = 'chip text-[10px] py-0.5 px-2'
        } else if (p.id === 'gemini') {
          badgeText = '智能'
          badgeClass = 'chip text-[10px] py-0.5 px-2'
        } else if (p.id === 'grok') {
          badgeText = '新锐'
          badgeClass = 'chip-gold text-[10px] py-0.5 px-2'
        }

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
              isFlagship && 'ring-1 ring-celadon-200',
              disabled && 'opacity-50 hover:translate-y-0 cursor-not-allowed'
            )}
          >
            <div className="relative flex items-center justify-between gap-2">
              <div
                className={cn(
                  'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-ink-700/10 text-xs font-semibold text-rice-50 shadow-[0_10px_24px_-16px_rgba(20,18,12,.55)] sm:h-11 sm:w-11 sm:text-sm'
                )}
                style={{ background: `linear-gradient(135deg, ${p.color || '#1F6B66'}, ${p.color || '#1F6B66'}cc)` }}
              >
                {p.logo ? (
                  <img
                    src={p.logo}
                    alt={p.name}
                    className="h-5 w-5 object-contain sm:h-6 sm:w-6"
                  />
                ) : (
                  <span className="tracking-normal">
                    {p.initial}
                  </span>
                )}
              </div>
              {count > 0 ? (
                <span className={cn('shrink-0 rounded-full', badgeClass)}>
                  {badgeText}
                </span>
              ) : (
                <span className="shrink-0 rounded-full border border-gold-500/25 bg-gold-500/10 px-2 py-0.5 text-[9px] text-gold-600">
                  无
                </span>
              )}
            </div>

            <h3 className="relative mt-3 text-sm font-semibold text-ink-900 sm:mt-4 sm:text-base">
              {model?.name || p.name}
            </h3>
            <p className="relative mt-1 line-clamp-2 text-[11px] text-ink-500 leading-relaxed sm:text-xs h-8 overflow-hidden">
              {model?.remark || p.description}
            </p>

            <div className="relative mt-3 flex items-center justify-end text-[11px]">
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
