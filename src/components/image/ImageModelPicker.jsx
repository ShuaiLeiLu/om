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
        className="flex h-8 max-w-[min(72vw,22rem)] items-center gap-1.5 rounded-lg border border-ink-700/10 bg-rice-50 px-2.5 text-xs text-ink-900 shadow-[var(--shadow-paper)] transition hover:bg-rice-100 sm:h-9 sm:max-w-sm sm:px-3 sm:text-sm"
      >
        <span
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ background: selected?.color || '#1F6B66' }}
        />
        <span className="truncate font-medium">{selected?.name || '选择模型'}</span>
        {selected?.providerName && (
          <span className="hidden shrink-0 text-[10px] text-ink-500 sm:inline">{selected.providerName}</span>
        )}
        <ChevronDown size={14} className="shrink-0 text-ink-500" />
      </button>

      {open && (
        <div className="absolute left-0 z-30 mt-2 w-[min(88vw,22rem)] max-h-96 overflow-y-auto rounded-2xl border border-ink-700/10 bg-rice-50 shadow-[var(--shadow-paper-lg)] scrollbar-thin sm:w-80">
          <div className="p-2">
            {models.length === 0 ? (
              <div className="px-3 py-6 text-center text-xs text-ink-500">
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
                      ? 'bg-celadon-50 border border-celadon-600/20'
                      : 'border border-transparent hover:bg-rice-100'
                  )}
                >
                  <div
                    className="mt-0.5 h-7 w-7 shrink-0 rounded-lg flex items-center justify-center text-[10px] font-bold text-rice-50"
                    style={{
                      background: m.color || '#1F6B66'
                    }}
                  >
                    {m.initial}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-ink-900 truncate">{m.name}</p>
                    <p className="text-[10px] text-ink-500 truncate font-mono">{m.id}</p>
                    {m.providerName && (
                      <p className="text-[10px] text-ink-500 mt-0.5">{m.providerName}</p>
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
