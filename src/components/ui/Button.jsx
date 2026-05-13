'use client'

import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

const variants = {
  gradient:
    'text-white shadow-[0_8px_24px_rgba(99,102,241,0.28)] disabled:opacity-50 disabled:cursor-not-allowed ' +
    'bg-[linear-gradient(135deg,#6366f1,#a855f7,#ec4899)] bg-[length:200%_200%] bg-[position:0%_50%] ' +
    'hover:bg-[position:100%_50%] active:scale-[0.97] transition-all',
  glass:
    'text-slate-200 bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 ' +
    'active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed',
  ghost:
    'text-slate-300 hover:bg-white/5 hover:text-white transition-colors disabled:opacity-50',
  danger:
    'text-white bg-rose-500/90 hover:bg-rose-500 border border-rose-400/30 transition-all ' +
    'active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed',
  outline:
    'text-slate-200 bg-transparent border border-white/15 hover:bg-white/5 hover:border-white/25 ' +
    'transition-all disabled:opacity-50 disabled:cursor-not-allowed'
}

const sizes = {
  sm: 'h-8 px-3 text-xs rounded-lg',
  md: 'h-10 px-4 text-sm rounded-xl',
  lg: 'h-12 px-5 text-base rounded-xl',
  icon: 'h-10 w-10 rounded-xl',
  'icon-sm': 'h-8 w-8 rounded-lg'
}

export const Button = forwardRef(function Button(
  { variant = 'glass', size = 'md', className, children, ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center gap-2 font-medium select-none',
        variants[variant],
        sizes[size],
        className
      )}
      {...rest}
    >
      {children}
    </button>
  )
})

export default Button
