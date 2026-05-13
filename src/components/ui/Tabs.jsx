'use client'

import { cn } from '@/lib/utils'

export function SegmentedControl({ value, onChange, options, className, size = 'md' }) {
  const sizeClass = {
    sm: 'p-0.5 text-[11px]',
    md: 'p-1 text-xs',
    lg: 'p-1.5 text-sm'
  }[size]
  const buttonSize = {
    sm: 'h-6 px-2 rounded-md gap-1',
    md: 'h-8 px-3 rounded-lg gap-1.5',
    lg: 'h-10 px-4 rounded-xl gap-2'
  }[size]

  return (
    <div
      className={cn(
        'inline-flex rounded-xl border border-white/8 bg-white/[0.05]',
        sizeClass,
        className
      )}
    >
      {options.map((opt) => {
        const active = value === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              'inline-flex items-center justify-center font-medium transition-all',
              buttonSize,
              active
                ? 'bg-gradient-to-br from-indigo-500/70 to-purple-500/60 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] border border-white/15'
                : 'text-slate-400 hover:text-slate-200'
            )}
          >
            {opt.icon && <opt.icon size={size === 'sm' ? 12 : size === 'lg' ? 16 : 14} />}
            <span>{opt.label}</span>
          </button>
        )
      })}
    </div>
  )
}

export default SegmentedControl
