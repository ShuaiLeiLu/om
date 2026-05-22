'use client'

import { memo, useState } from 'react'
import { AlertCircle, Copy, Check, RotateCcw } from 'lucide-react'
import Markdown from '@/components/chat/Markdown'
import { cn } from '@/lib/utils'

function MessageBubbleImpl({ message, provider, model, onRetry }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content || '')
      setCopied(true)
      setTimeout(() => setCopied(false), 1400)
    } catch {}
  }

  if (message.role === 'user') {
    return (
      <div className="flex w-full justify-end animate-in">
        <div className="group max-w-[92%] sm:max-w-[85%] md:max-w-[78%]">
          {message.images?.length > 0 && (
            <div className="mb-2 flex flex-wrap justify-end gap-2">
              {message.images.map((img, i) => (
                <a key={i} href={img} target="_blank" rel="noreferrer" className="overflow-hidden rounded-xl border border-white/10 transition-transform duration-300 hover:scale-[1.02]">
                  <img
                    src={img}
                    className="max-h-56 sm:max-h-64 object-cover"
                    alt=""
                  />
                </a>
              ))}
            </div>
          )}
          <div className="relative rounded-2xl rounded-tr-md border border-indigo-400/25 bg-gradient-to-br from-indigo-500/15 to-fuchsia-500/10 px-4 py-2.5 text-[14px] leading-relaxed text-slate-100 shadow-[0_4px_20px_rgba(99,102,241,0.12)] backdrop-blur-md sm:px-4.5 sm:text-[14.5px] overflow-hidden">
            {/* Inner dynamic highlight */}
            <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/5 via-transparent to-fuchsia-500/5 pointer-events-none" />
            <span className="relative z-10 whitespace-pre-wrap break-words">{message.content}</span>
          </div>
        </div>
      </div>
    )
  }

  // assistant
  const isDeepseek = provider?.id === 'deepseek'
  return (
    <div className="group flex w-full justify-start animate-in">
      <div className="max-w-[94%] sm:max-w-[88%] md:max-w-[82%]">
        <div className="mb-1.5 flex items-center gap-2 pl-1">
          <div
            className={cn(
              "relative flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-white/10 overflow-hidden transition-all duration-300",
              message.loading ? "ring-1 ring-purple-500/50" : ""
            )}
            style={{
              boxShadow: `0 0 10px ${provider?.color || '#8b5cf6'}20`
            }}
          >
            {/* Spinning gradient for loading ring */}
            {message.loading && (
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-500 animate-spin opacity-80" />
            )}
            <div className="relative z-10 flex h-[18px] w-[18px] items-center justify-center rounded-full bg-slate-950 overflow-hidden">
              {provider?.logo ? (
                <img src={provider.logo} alt="" className={cn("h-3 w-3 object-contain", isDeepseek && "invert-0")} />
              ) : (
                <span className="text-[9px] font-bold" style={{ color: provider?.color || '#8b5cf6' }}>
                  {provider?.initial || 'A'}
                </span>
              )}
            </div>
          </div>
          <span className="truncate text-[10px] font-bold uppercase tracking-widest text-slate-400">
            {model?.name || 'Assistant'}
          </span>
        </div>

        <div
          className={cn(
            'relative rounded-2xl rounded-tl-md border border-white/[0.05] bg-white/[0.02] px-4 py-3 backdrop-blur-xl sm:px-4.5 shadow-[0_8px_32px_rgba(0,0,0,0.2)] transition-all duration-300 hover:border-white/[0.08] hover:bg-white/[0.03]',
            message.error && 'border-rose-500/25 bg-rose-950/15 text-rose-100 shadow-[0_4px_20px_rgba(244,63,94,0.08)]'
          )}
        >
          {message.loading && (!message.content || message.content.length === 0) ? (
            <div className="flex items-center gap-1.5 py-1.5">
              <div className="typing-dot" />
              <div className="typing-dot" />
              <div className="typing-dot" />
            </div>
          ) : message.error ? (
            <div className="flex items-start gap-2 text-rose-200">
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium break-words">{message.error}</p>
                {onRetry && (
                  <button
                    onClick={onRetry}
                    className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-rose-400/30 bg-rose-500/10 px-2.5 py-1.5 text-xs text-rose-200 transition hover:bg-rose-500/20 tap-transparent active:scale-95"
                  >
                    <RotateCcw size={11} /> 重试
                  </button>
                )}
              </div>
            </div>
          ) : (
            <Markdown content={message.content} />
          )}
        </div>

        {!message.loading && !message.error && message.content && (
          <div className="mt-1.5 flex items-center gap-1 pl-2 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100">
            <button
              onClick={handleCopy}
              className="flex min-h-[32px] items-center gap-1 rounded-md px-2 py-1 text-[10px] text-slate-500 transition-all duration-200 hover:bg-white/5 hover:text-slate-200 tap-transparent active:scale-95"
            >
              {copied ? (
                <>
                  <Check size={10} className="text-emerald-400" /> 已复制
                </>
              ) : (
                <>
                  <Copy size={10} /> 复制
                </>
              )}
            </button>
            {onRetry && (
              <button
                onClick={onRetry}
                className="flex min-h-[32px] items-center gap-1 rounded-md px-2 py-1 text-[10px] text-slate-500 transition-all duration-200 hover:bg-white/5 hover:text-slate-200 tap-transparent active:scale-95"
              >
                <RotateCcw size={10} /> 重新生成
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export const MessageBubble = memo(MessageBubbleImpl, (prev, next) => {
  // Re-render only when the message content/state, model, provider identity, or retry handler change.
  const a = prev.message
  const b = next.message
  return (
    a === b ||
    (a?.id === b?.id &&
      a?.content === b?.content &&
      a?.loading === b?.loading &&
      a?.error === b?.error &&
      prev.provider?.id === next.provider?.id &&
      prev.model?.id === next.model?.id &&
      prev.onRetry === next.onRetry)
  )
})

export default MessageBubble
