'use client'

import { cn } from '@/lib/utils'

const TONES = {
  emerald: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200',
  rose: 'border-rose-400/30 bg-rose-500/10 text-rose-200',
  amber: 'border-amber-400/30 bg-amber-500/10 text-amber-200',
  indigo: 'border-indigo-400/30 bg-indigo-500/10 text-indigo-200',
  fuchsia: 'border-fuchsia-400/30 bg-fuchsia-500/10 text-fuchsia-200',
  sky: 'border-sky-400/30 bg-sky-500/10 text-sky-200',
  slate: 'border-white/10 bg-white/5 text-slate-300'
}

export function Badge({ tone = 'slate', children, className }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium',
        TONES[tone] || TONES.slate,
        className
      )}
    >
      {children}
    </span>
  )
}

export default Badge
