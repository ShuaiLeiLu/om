'use client'

import { ChevronDown } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'

export function ImageModelPicker({ models, value, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const selected = models.find((m) => m.id === value)

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-sm text-white transition hover:bg-white/[0.08]"
      >
        <span
          className="h-2 w-2 rounded-full"
          style={{ background: selected?.color || '#a855f7' }}
        />
        <span className="font-medium">{selected?.name || '选择模型'}</span>
        <span className="text-[10px] text-slate-500">{selected?.providerName}</span>
        <ChevronDown size={14} className="text-slate-400" />
      </button>

      {open && (
        <div className="absolute right-0 z-30 mt-2 w-80 max-h-96 overflow-y-auto rounded-2xl border border-white/10 bg-slate-950/95 backdrop-blur-2xl shadow-[0_20px_60px_rgba(0,0,0,0.4)] scrollbar-thin">
          <div className="p-2">
            {models.length === 0 ? (
              <div className="px-3 py-6 text-center text-xs text-slate-500">
                暂无可用的图片生成模型
              </div>
            ) : (
              models.map((m) => (
                <button
                  key={m.id}
                  onClick={() => {
                    onChange?.(m.id)
                    setOpen(false)
                  }}
                  className={cn(
                    'flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition',
                    m.id === value
                      ? 'bg-indigo-500/15 border border-indigo-400/30'
                      : 'border border-transparent hover:bg-white/5'
                  )}
                >
                  <div
                    className="mt-0.5 h-7 w-7 shrink-0 rounded-lg flex items-center justify-center text-[10px] font-bold text-white"
                    style={{
                      background: `linear-gradient(135deg, ${m.color || '#6366f1'}, #a855f7)`
                    }}
                  >
                    {m.initial}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-white truncate">{m.name}</p>
                    <p className="text-[10px] text-slate-500 truncate font-mono">{m.id}</p>
                    {m.providerName && (
                      <p className="text-[10px] text-slate-400 mt-0.5">{m.providerName}</p>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default ImageModelPicker
