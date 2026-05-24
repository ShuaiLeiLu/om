'use client'

import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Info, X, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

const listeners = new Set()
let toasts = []
let toastId = 0

function notify() {
  listeners.forEach((listener) => listener([...toasts]))
}

function normalizeToast(messageOrOptions, options = {}) {
  if (typeof messageOrOptions === 'object' && messageOrOptions !== null) {
    return messageOrOptions
  }

  return {
    title: messageOrOptions,
    description: options.description,
    variant: options.variant
  }
}

function addToast(messageOrOptions, options) {
  const payload = normalizeToast(messageOrOptions, options)
  const id = ++toastId
  const nextToast = {
    id,
    variant: payload.variant || 'default',
    title: payload.title || '',
    description: payload.description || '',
    duration: payload.duration ?? 3200
  }

  toasts = [nextToast, ...toasts].slice(0, 4)
  notify()

  window.setTimeout(() => {
    dismissToast(id)
  }, nextToast.duration)

  return id
}

function dismissToast(id) {
  toasts = toasts.filter((item) => item.id !== id)
  notify()
}

export function toast(messageOrOptions, options) {
  return addToast(messageOrOptions, options)
}

toast.success = (title, options = {}) => addToast({ ...options, title, variant: 'success' })
toast.error = (title, options = {}) => addToast({ ...options, title, variant: 'error' })
toast.info = (title, options = {}) => addToast({ ...options, title, variant: 'info' })
toast.message = (title, options = {}) => addToast({ ...options, title, variant: 'default' })
toast.dismiss = dismissToast

const tone = {
  success: {
    icon: CheckCircle2,
    className: 'border-celadon-600/25 bg-rice-50 text-ink-900',
    iconClassName: 'text-celadon-700'
  },
  error: {
    icon: XCircle,
    className: 'border-verm-500/30 bg-rice-50 text-ink-900',
    iconClassName: 'text-verm-600'
  },
  info: {
    icon: Info,
    className: 'border-celadon-600/20 bg-rice-50 text-ink-900',
    iconClassName: 'text-celadon-700'
  },
  default: {
    icon: Info,
    className: 'border-ink-700/10 bg-rice-50 text-ink-900',
    iconClassName: 'text-ink-500'
  }
}

export function Toaster({ position = 'top-center', className }) {
  const [items, setItems] = useState([])

  useEffect(() => {
    const listener = (nextItems) => setItems(nextItems)
    listeners.add(listener)
    listener([...toasts])
    return () => {
      listeners.delete(listener)
    }
  }, [])

  const positionClassName = useMemo(() => {
    if (position === 'top-right') return 'right-4 top-4 items-end'
    if (position === 'bottom-right') return 'bottom-4 right-4 items-end'
    if (position === 'bottom-center') return 'bottom-4 left-1/2 -translate-x-1/2 items-center'
    return 'left-1/2 top-4 -translate-x-1/2 items-center'
  }, [position])

  return (
    <div
      className={cn(
        'pointer-events-none fixed z-[100] flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-2',
        positionClassName,
        className
      )}
      aria-live="polite"
      aria-relevant="additions text"
    >
      {items.map((item) => {
        const config = tone[item.variant] || tone.default
        const Icon = config.icon

        return (
          <div
            key={item.id}
            className={cn(
              'pointer-events-auto flex w-full items-start gap-3 rounded-xl border px-3 py-3 shadow-[var(--shadow-paper-lg)] backdrop-blur-xl',
              config.className
            )}
          >
            <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', config.iconClassName)} />
            <div className="min-w-0 flex-1">
              {item.title && <p className="text-sm font-medium leading-5">{item.title}</p>}
              {item.description && (
                <p className="mt-0.5 text-xs leading-5 text-ink-500">{item.description}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => dismissToast(item.id)}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-ink-400 transition hover:bg-ink-700/5 hover:text-ink-900"
              aria-label="关闭通知"
            >
              <X size={14} />
            </button>
          </div>
        )
      })}
    </div>
  )
}
