'use client'

import { createContext, useContext, useState, useCallback } from 'react'
import { X, AlertCircle, CheckCircle2, Info } from 'lucide-react'
import { cn } from '@/lib/utils'
import { uid } from '@/lib/utils'

const ToastContext = createContext({ toast: () => {} })

export function ToastProvider({ children }) {
  const [items, setItems] = useState([])

  const dismiss = useCallback((id) => {
    setItems((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const toast = useCallback(
    ({ title, description, variant = 'info', duration = 3500 }) => {
      const id = uid('toast')
      setItems((prev) => [...prev, { id, title, description, variant }])
      if (duration > 0) {
        setTimeout(() => dismiss(id), duration)
      }
      return id
    },
    [dismiss]
  )

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-6 z-[200] flex flex-col items-center gap-2 px-4">
        {items.map((t) => (
          <ToastItem key={t.id} {...t} onClose={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}

function ToastItem({ title, description, variant, onClose }) {
  const Icon = variant === 'success' ? CheckCircle2 : variant === 'error' ? AlertCircle : Info
  const accent =
    variant === 'success'
      ? 'text-emerald-300 border-emerald-400/30 bg-emerald-500/10'
      : variant === 'error'
        ? 'text-rose-300 border-rose-400/30 bg-rose-500/10'
        : 'text-indigo-300 border-indigo-400/30 bg-indigo-500/10'
  return (
    <div
      className={cn(
        'pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-2xl border bg-slate-950/85 px-4 py-3 backdrop-blur-2xl shadow-[0_12px_36px_rgba(0,0,0,0.3)] animate-in',
        accent
      )}
    >
      <Icon size={18} className="mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        {title && <p className="text-sm font-semibold text-slate-100">{title}</p>}
        {description && <p className="mt-0.5 text-xs text-slate-300/80 leading-relaxed">{description}</p>}
      </div>
      <button
        onClick={onClose}
        className="ml-1 shrink-0 rounded-md p-1 text-slate-400 transition hover:bg-white/5 hover:text-white"
      >
        <X size={14} />
      </button>
    </div>
  )
}
