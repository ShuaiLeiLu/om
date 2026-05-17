'use client'

// AdminInput / AdminTextarea / AdminField → 包装 shadcn Input / Textarea / Label
import * as React from 'react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

export const AdminInput = React.forwardRef(function AdminInput(
  { className, size = 'md', align = 'left', icon: Icon, mono = false, ...rest },
  ref
) {
  const heightClass = {
    sm: 'h-8 text-[11px]',
    md: 'h-9 text-xs',
    lg: 'h-10 text-sm'
  }[size]

  const inputEl = (
    <Input
      ref={ref}
      {...rest}
      className={cn(
        heightClass,
        Icon && (size === 'sm' ? 'pl-8' : 'pl-9'),
        align === 'right' && 'text-right',
        align === 'center' && 'text-center',
        mono && 'font-mono tracking-tight',
        className
      )}
    />
  )

  if (!Icon) return inputEl

  return (
    <div className="relative">
      <Icon
        size={size === 'sm' ? 12 : 13}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
      />
      {inputEl}
    </div>
  )
})

export const AdminTextarea = React.forwardRef(function AdminTextarea({ className, ...rest }, ref) {
  return <Textarea ref={ref} className={cn('text-xs', className)} {...rest} />
})

export const AdminLabel = ({ children, className }) => (
  <Label
    className={cn(
      'mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground',
      className
    )}
  >
    {children}
  </Label>
)

export const AdminField = ({ label, children, className, hint }) => (
  <div className={cn('block', className)}>
    {label && <AdminLabel>{label}</AdminLabel>}
    {children}
    {hint && <p className="mt-1 text-[10px] text-muted-foreground">{hint}</p>}
  </div>
)

export default AdminInput
