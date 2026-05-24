'use client'

import { cn } from '@/lib/utils'

export function Seal({ children, className, style, size = 'md' }) {
  return (
    <div
      style={style}
      className={cn(
        'seal flex flex-col items-center justify-center text-center font-serif font-bold text-rice-50 select-none pointer-events-none',
        size === 'sm' && 'h-10 w-10 text-[10px] rounded-lg tracking-wider',
        size === 'md' && 'h-14 w-14 text-xs rounded-xl tracking-widest',
        size === 'lg' && 'h-20 w-20 text-base rounded-2xl tracking-[0.2em]',
        className
      )}
      aria-hidden="true"
    >
      {children}
    </div>
  )
}

export default Seal
