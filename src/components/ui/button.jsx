import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cn } from '@/lib/utils'

const variantClasses = {
  default:
    'border border-white/10 bg-white/10 text-slate-100 hover:bg-white/15 active:bg-white/20',
  gradient:
    'border border-white/15 bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] hover:brightness-110 active:brightness-95',
  glass:
    'border border-white/10 bg-white/[0.05] text-slate-200 hover:bg-white/[0.09] active:bg-white/[0.12]',
  ghost:
    'border border-transparent bg-transparent text-slate-400 hover:bg-white/5 hover:text-slate-100 active:bg-white/10',
  outline:
    'border border-white/12 bg-transparent text-slate-200 hover:bg-white/[0.06] active:bg-white/[0.1]',
  danger:
    'border border-rose-400/30 bg-rose-500/15 text-rose-100 hover:bg-rose-500/25 active:bg-rose-500/30'
}

const sizeClasses = {
  sm: 'min-h-9 rounded-lg px-3 py-1.5 text-xs',
  md: 'min-h-10 rounded-xl px-4 py-2 text-sm',
  lg: 'min-h-11 rounded-xl px-5 py-2.5 text-sm',
  icon: 'h-10 w-10 rounded-xl p-0'
}

export function buttonVariants({ variant = 'default', size = 'md', className } = {}) {
  return cn(
    'inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-all tap-transparent disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60',
    variantClasses[variant] || variantClasses.default,
    sizeClasses[size] || sizeClasses.md,
    className
  )
}

export const Button = React.forwardRef(function Button(
  { className, variant = 'default', size = 'md', asChild = false, type = 'button', ...props },
  ref
) {
  const Comp = asChild ? Slot : 'button'
  return (
    <Comp
      ref={ref}
      type={asChild ? undefined : type}
      className={buttonVariants({ variant, size, className })}
      {...props}
    />
  )
})

export default Button
