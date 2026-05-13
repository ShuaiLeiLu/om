'use client'

import { useEffect, useCallback } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

// Responsive dialog.
// On mobile the dialog becomes a near-full-screen sheet with safe-area padding;
// on md+ it follows the size prop (sm | md | lg | xl | full).
export function Dialog({ open, onClose, children, className, size = 'md' }) {
  const handleKey = useCallback(
    (e) => {
      if (e.key === 'Escape') onClose?.()
    },
    [onClose]
  )

  useEffect(() => {
    if (!open) return
    document.addEventListener('keydown', handleKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.body.style.overflow = ''
    }
  }, [open, handleKey])

  if (!open) return null

  const sizeClass = {
    sm: 'md:max-w-md',
    md: 'md:max-w-xl',
    lg: 'md:max-w-3xl',
    xl: 'md:max-w-5xl',
    full: 'md:max-w-[95vw]'
  }[size]

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center p-0 animate-fade-in md:items-center md:p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div
        className={cn(
          'relative flex w-full max-h-[95dvh] flex-col overflow-hidden border border-white/10 bg-slate-950/95 backdrop-blur-2xl shadow-[0_24px_80px_rgba(0,0,0,0.5)]',
          'rounded-t-3xl md:rounded-2xl md:max-h-[90dvh]',
          'animate-in',
          sizeClass,
          className
        )}
      >
        {children}
      </div>
    </div>
  )
}

export function DialogHeader({ title, description, onClose, children }) {
  return (
    <div className="flex shrink-0 items-start justify-between border-b border-white/5 px-5 py-4 md:px-6">
      <div className="min-w-0 flex-1">
        {title && <h2 className="text-base font-semibold text-white md:text-lg">{title}</h2>}
        {description && <p className="mt-1 text-xs text-slate-400">{description}</p>}
        {children}
      </div>
      {onClose && (
        <button
          onClick={onClose}
          className="ml-3 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white/5 hover:text-white tap-transparent"
          aria-label="关闭"
        >
          <X size={16} />
        </button>
      )}
    </div>
  )
}

export function DialogBody({ className, children }) {
  return (
    <div className={cn('flex-1 overflow-y-auto px-5 py-4 scrollbar-thin md:px-6 md:py-5', className)}>
      {children}
    </div>
  )
}

export function DialogFooter({ className, children }) {
  return (
    <div
      className={cn(
        'flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-white/5 bg-white/[0.02] px-4 py-3 pb-safe md:px-6',
        className
      )}
    >
      {children}
    </div>
  )
}
