'use client'

import { ChevronRight } from 'lucide-react'
import { detectModelBadges } from '@/lib/model-badges'
import { cn } from '@/lib/utils'

export function ModelCard({ model, onClick }) {
  const badges = detectModelBadges(model)
  return (
    <button
      onClick={onClick}
      className={cn(
        'group flex flex-col rounded-2xl border border-white/8 bg-white/[0.03] p-3.5 md:p-4 text-left backdrop-blur-xl transition-all',
        'hover:-translate-y-0.5 hover:border-indigo-400/30 hover:bg-white/[0.06]',
        'active:scale-[0.99]'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-white leading-tight">{model.name}</p>
        <ChevronRight
          size={14}
          className="shrink-0 text-slate-600 transition-all group-hover:translate-x-0.5 group-hover:text-indigo-300"
        />
      </div>
      <p className="mt-1 truncate text-[10px] text-slate-500 font-mono">{model.id}</p>

      {badges.length > 0 && (
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          {badges.map((b) => (
            <span
              key={b.label}
              className={cn(
                'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium',
                b.className
              )}
            >
              {b.label}
            </span>
          ))}
        </div>
      )}

      {model.remark && (
        <p className="mt-2 line-clamp-2 text-[11px] text-slate-400 leading-relaxed">
          {model.remark}
        </p>
      )}
    </button>
  )
}

export default ModelCard
