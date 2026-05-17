'use client'

import { ChevronDown, Trash2, RefreshCw, Coins, Circle, MoreHorizontal } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

// Mobile-aware chat header. On lg+ it shows full info inline.
// On smaller screens the actions move behind a "..." menu and the model name shrinks.
export function ChatHeader({
  provider,
  model,
  tokenBalance,
  isStreaming,
  onChangeModel,
  onClearHistory,
  onRegenerate,
  canRegenerate
}) {
  const isDeepseek = provider?.id === 'deepseek'
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    document.addEventListener('touchstart', handler, { passive: true })
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('touchstart', handler)
    }
  }, [])

  return (
    <div className="hidden h-14 shrink-0 items-center justify-between gap-3 border-b border-white/8 bg-slate-950/40 px-4 backdrop-blur-2xl pl-safe pr-safe md:flex md:px-6">
      <button
        onClick={onChangeModel}
        className="group flex min-w-0 items-center gap-3 rounded-xl border border-transparent px-2 py-1.5 transition-all hover:border-white/10 hover:bg-white/5 tap-transparent"
      >
        <div
          className={cn(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/10',
            isDeepseek ? 'bg-white' : ''
          )}
          style={!isDeepseek ? { backgroundColor: `${provider?.color}20` } : undefined}
        >
          {provider?.logo ? (
            <img src={provider.logo} alt="" className="h-5 w-5 object-contain" />
          ) : (
            <span className="text-xs font-bold" style={{ color: provider?.color }}>
              {provider?.initial}
            </span>
          )}
        </div>
        <div className="flex min-w-0 flex-col items-start">
          <div className="flex items-center gap-1.5">
            <span className="truncate max-w-[200px] text-sm font-semibold text-white lg:max-w-none">
              {model?.name}
            </span>
            <ChevronDown
              size={12}
              className="text-slate-500 transition-transform group-hover:translate-y-0.5"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <Circle
              size={6}
              className={cn(
                'fill-current',
                isStreaming ? 'text-amber-400' : 'text-emerald-400'
              )}
            />
            <span className="truncate text-[10px] uppercase tracking-widest text-slate-500">
              {isStreaming ? '响应中' : provider?.name}
            </span>
          </div>
        </div>
      </button>

      <div className="flex shrink-0 items-center gap-2">
        {tokenBalance != null && (
          <div className="hidden lg:flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5">
            <Coins size={12} className="text-amber-300" />
            <span className="text-xs font-mono text-slate-200">
              {tokenBalance.toLocaleString('en-US')}
            </span>
            <span className="text-[10px] text-slate-500">算力点</span>
          </div>
        )}

        {/* Desktop: spread actions */}
        <div className="hidden lg:flex items-center gap-2">
          <HeaderIconButton
            icon={RefreshCw}
            label="重新生成上一条"
            disabled={!canRegenerate || isStreaming}
            onClick={onRegenerate}
          />
          <HeaderIconButton
            icon={Trash2}
            label="清空当前对话"
            danger
            disabled={isStreaming}
            onClick={onClearHistory}
          />
        </div>

        {/* Tablet (md → lg): condensed menu */}
        <div className="relative lg:hidden" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/8 bg-white/[0.03] text-slate-300 transition hover:bg-white/[0.06] tap-transparent"
            aria-label="更多操作"
          >
            <MoreHorizontal size={16} />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full z-30 mt-2 w-44 rounded-2xl border border-white/10 bg-slate-950/95 p-1 backdrop-blur-2xl shadow-[0_20px_60px_rgba(0,0,0,0.45)] animate-fade-in">
              <MenuItem
                icon={RefreshCw}
                label="重新生成"
                disabled={!canRegenerate || isStreaming}
                onClick={() => {
                  setMenuOpen(false)
                  onRegenerate?.()
                }}
              />
              <MenuItem
                icon={Trash2}
                label="清空对话"
                danger
                disabled={isStreaming}
                onClick={() => {
                  setMenuOpen(false)
                  onClearHistory?.()
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function HeaderIconButton({ icon: Icon, label, danger, ...rest }) {
  return (
    <button
      title={label}
      className={cn(
        'flex h-9 w-9 items-center justify-center rounded-xl border border-white/8 bg-white/[0.03] text-slate-400 transition-all',
        'hover:bg-white/[0.06] hover:border-white/15 hover:text-slate-100',
        danger && 'hover:text-rose-300 hover:border-rose-400/30 hover:bg-rose-500/10',
        'disabled:opacity-40 disabled:pointer-events-none active:scale-95 tap-transparent'
      )}
      {...rest}
    >
      <Icon size={14} />
    </button>
  )
}

function MenuItem({ icon: Icon, label, danger, ...rest }) {
  return (
    <button
      className={cn(
        'flex w-full min-h-[40px] items-center gap-2 rounded-xl px-3 text-sm text-slate-200 transition tap-transparent',
        'hover:bg-white/5 disabled:opacity-40 disabled:pointer-events-none',
        danger && 'hover:bg-rose-500/10 hover:text-rose-300'
      )}
      {...rest}
    >
      <Icon size={14} />
      <span>{label}</span>
    </button>
  )
}

export default ChatHeader
