'use client'

import { cn } from '@/lib/utils'

export function Card({ className, intensity = 'normal', glow = false, children, ...rest }) {
  const intensityClass = {
    subtle: 'bg-white/[0.025] backdrop-blur-md border-white/[0.05]',
    normal: 'bg-white/[0.04] backdrop-blur-xl border-white/[0.08]',
    strong: 'bg-white/[0.06] backdrop-blur-2xl border-white/[0.1]'
  }[intensity]
  return (
    <div
      className={cn(
        'rounded-2xl border',
        intensityClass,
        glow && 'shadow-[0_8px_32px_rgba(99,102,241,0.18)]',
        className
      )}
      {...rest}
    >
      {children}
    </div>
  )
}

export function CardHeader({ className, ...rest }) {
  return <div className={cn('px-5 pt-4 pb-2', className)} {...rest} />
}

export function CardBody({ className, ...rest }) {
  return <div className={cn('px-5 py-4', className)} {...rest} />
}

export function CardFooter({ className, ...rest }) {
  return <div className={cn('px-5 pt-2 pb-4', className)} {...rest} />
}

export function CardTitle({ className, ...rest }) {
  return <h3 className={cn('text-sm font-semibold text-white', className)} {...rest} />
}

export function CardDescription({ className, ...rest }) {
  return <p className={cn('text-xs text-slate-400 mt-1', className)} {...rest} />
}
