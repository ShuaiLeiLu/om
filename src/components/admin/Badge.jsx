'use client'

import { cn } from '@/lib/utils'

const TONES = {
  emerald: 'border-celadon-600/30 bg-celadon-50 text-celadon-700',
  rose: 'border-verm-500/30 bg-verm-500/10 text-verm-600',
  amber: 'border-gold-500/30 bg-gold-500/10 text-gold-600',
  indigo: 'border-celadon-600/30 bg-celadon-50 text-celadon-700',
  fuchsia: 'border-verm-500/30 bg-verm-500/10 text-verm-600',
  sky: 'border-celadon-600/30 bg-celadon-50 text-celadon-700',
  slate: 'border-ink-700/10 bg-rice-100 text-ink-600'
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
