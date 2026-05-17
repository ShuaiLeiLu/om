'use client'

import { cn } from '@/lib/utils'

export function AdminCard({ className, padding = 'normal', intensity = 'normal', children, ...rest }) {
  const padClass = {
    none: '',
    sm: 'p-3 md:p-4',
    normal: 'p-4 md:p-5',
    lg: 'p-5 md:p-6'
  }[padding]
  const intensityClass = {
    subtle: 'bg-white/[0.025] backdrop-blur-md border-white/[0.05]',
    normal: 'bg-white/[0.04] backdrop-blur-xl border-white/[0.08]',
    strong: 'bg-white/[0.06] backdrop-blur-2xl border-white/[0.1]'
  }[intensity]
  return (
    <div
      className={cn('rounded-2xl border', intensityClass, padClass, className)}
      {...rest}
    >
      {children}
    </div>
  )
}

export function AdminCardHeader({ title, description, action, className }) {
  return (
    <div className={cn('flex flex-wrap items-start justify-between gap-3 pb-3 md:pb-4', className)}>
      <div className="min-w-0">
        {title && <h2 className="text-sm font-semibold text-white md:text-base">{title}</h2>}
        {description && (
          <p className="mt-0.5 text-[11px] text-slate-400 md:text-xs">{description}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

export default AdminCard
