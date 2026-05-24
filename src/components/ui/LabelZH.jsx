'use client'

import { cn } from '@/lib/utils'

export function LabelZH({ children, className, style }) {
  const spacedText = typeof children === 'string' 
    ? children.trim().split('').join(' ') 
    : children

  return (
    <span
      style={style}
      className={cn('label-zh font-serif tracking-[0.25em] text-[10px] sm:text-xs select-none uppercase', className)}
    >
      {spacedText}
    </span>
  )
}

export default LabelZH
