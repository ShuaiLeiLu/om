'use client'

import * as React from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

const sizeClasses = {
  sm: 'max-w-md',
  md: 'max-w-2xl',
  lg: 'max-w-4xl',
  xl: 'max-w-6xl'
}

export function Dialog({ open, onClose, size = 'lg', children }) {
  React.useEffect(() => {
    if (!open) return undefined
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', handleKeyDown)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <button
        type="button"
        aria-label="关闭弹窗"
        className="absolute inset-0 bg-ink-900/35 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className={cn(
          'relative z-10 flex max-h-[calc(100vh-2rem)] w-full flex-col overflow-hidden rounded-[28px] border border-ink-700/10 bg-rice-50 shadow-[var(--shadow-paper-lg)]',
          sizeClasses[size] || sizeClasses.lg
        )}
      >
        {children}
      </div>
    </div>
  )
}

export function DialogHeader({ title, description, onClose, children, className }) {
  return (
    <div className={cn('border-b border-ink-700/10 px-5 py-4 sm:px-6', className)}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          {title && <h2 className="font-serif text-base font-semibold text-ink-900">{title}</h2>}
          {description && <p className="mt-1 text-sm text-ink-500">{description}</p>}
          {children}
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-ink-500 transition hover:bg-ink-700/5 hover:text-ink-900"
            aria-label="关闭"
          >
            <X size={16} />
          </button>
        )}
      </div>
    </div>
  )
}

export function DialogBody({ className, children }) {
  return <div className={cn('min-h-0 flex-1 p-5 sm:p-6', className)}>{children}</div>
}

export function DialogFooter({ className, children }) {
  return (
    <div
      className={cn(
        'flex items-center justify-end gap-2 border-t border-ink-700/10 px-5 py-4 sm:px-6',
        className
      )}
    >
      {children}
    </div>
  )
}
