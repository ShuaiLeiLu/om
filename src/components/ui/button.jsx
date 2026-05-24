import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cn } from '@/lib/utils'

const variantClasses = {
  default:
    'border border-ink-700/10 bg-rice-50 text-ink-700 shadow-[var(--shadow-paper)] hover:bg-rice-100 active:bg-rice-200',
  gradient:
    'border border-celadon-700/10 bg-gradient-to-br from-celadon-600 to-celadon-500 text-rice-50 shadow-[var(--shadow-ink)] hover:brightness-105 active:brightness-95',
  glass:
    'border border-ink-700/10 bg-rice-50/80 text-ink-700 backdrop-blur-xl hover:bg-rice-50 active:bg-rice-100',
  ghost:
    'border border-transparent bg-transparent text-ink-500 hover:bg-ink-700/5 hover:text-ink-900 active:bg-ink-700/10',
  outline:
    'border border-ink-700/15 bg-transparent text-ink-700 hover:bg-rice-50 active:bg-rice-100',
  danger:
    'border border-verm-500/25 bg-verm-500/10 text-verm-600 hover:bg-verm-500/15 active:bg-verm-500/20'
}

const sizeClasses = {
  sm: 'min-h-9 rounded-lg px-3 py-1.5 text-xs',
  md: 'min-h-10 rounded-xl px-4 py-2 text-sm',
  lg: 'min-h-11 rounded-xl px-5 py-2.5 text-sm',
  icon: 'h-10 w-10 rounded-xl p-0'
}

export function buttonVariants({ variant = 'default', size = 'md', className } = {}) {
  return cn(
    'inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-all tap-transparent disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-celadon-500/70 focus-visible:ring-offset-2 focus-visible:ring-offset-rice-100',
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
