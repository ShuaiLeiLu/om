'use client'

import { useEffect } from 'react'
import { X, SlidersHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'
import ParamsPanel from './ParamsPanel'

// Bottom-sheet drawer for the image generation params on mobile.
// On md+ the page renders ParamsPanel directly in the sidebar instead.
export function ParamsDrawer({ open, onClose }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onClose?.()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[80] flex items-end animate-fade-in md:hidden">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className={cn(
          'relative w-full max-h-[85dvh] overflow-y-auto rounded-t-3xl border-t border-l border-r border-white/10',
          'bg-slate-950/95 backdrop-blur-2xl shadow-[0_-12px_40px_rgba(0,0,0,0.5)]',
          'pb-safe animate-in scrollbar-thin'
        )}
        style={{ animation: 'slide-up 0.25s ease-out forwards' }}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/5 bg-slate-950/95 px-4 py-3 backdrop-blur-2xl">
          <div className="flex items-center gap-2">
            <SlidersHorizontal size={14} className="text-fuchsia-300" />
            <h3 className="text-sm font-semibold text-white">生成参数</h3>
          </div>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition hover:bg-white/5 hover:text-white tap-transparent"
            aria-label="关闭"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-4 py-4">
          <ParamsPanel />
        </div>

        <div className="px-4 pb-3">
          <button
            onClick={onClose}
            className="flex h-11 w-full items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(99,102,241,0.35)] active:scale-[0.98] tap-transparent"
          >
            完成
          </button>
        </div>
      </div>

      <style jsx>{`
        @keyframes slide-up {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  )
}

export default ParamsDrawer
