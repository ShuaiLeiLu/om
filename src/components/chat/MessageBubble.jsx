'use client'

import { useState } from 'react'
import { AlertCircle, Copy, Check, RotateCcw } from 'lucide-react'
import Markdown from '@/components/chat/Markdown'
import { cn } from '@/lib/utils'

export function MessageBubble({ message, provider, model, onRetry }) {
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
                <a key={i} href={img} target="_blank" rel="noreferrer">
                  <img
                    src={img}
                    className="max-h-56 sm:max-h-64 rounded-xl border border-white/10 object-cover"
                    alt=""
                  />
                </a>
              ))}
            </div>
          )}
          <div className="rounded-2xl rounded-tr-md border border-indigo-400/30 bg-gradient-to-br from-indigo-500/15 to-fuchsia-500/10 px-3.5 py-2.5 text-[14px] leading-relaxed text-slate-100 shadow-[0_4px_16px_rgba(99,102,241,0.15)] backdrop-blur-md sm:px-4 sm:text-[14.5px]">
            <span className="whitespace-pre-wrap break-words">{message.content}</span>
          </div>
        </div>
      </div>
    )
  }

  // assistant
  return (
    <div className="group flex w-full justify-start animate-in">
      <div className="max-w-[94%] sm:max-w-[88%] md:max-w-[82%]">
        <div className="mb-1.5 flex items-center gap-2 pl-1">
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: provider?.color || '#a855f7' }}
          />
          <span className="truncate text-[10px] font-bold uppercase tracking-widest text-slate-500">
            {model?.name || 'Assistant'}
          </span>
        </div>

        <div
          className={cn(
            'relative rounded-2xl rounded-tl-md border border-white/10 bg-white/[0.04] px-3.5 py-3 backdrop-blur-xl sm:px-4',
            message.error && 'border-rose-400/30 bg-rose-500/10'
          )}
        >
          {message.loading && (!message.content || message.content.length === 0) ? (
            <div className="flex items-center gap-1.5 py-1">
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
                    className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-rose-400/30 bg-rose-500/10 px-2.5 py-1.5 text-xs text-rose-200 transition hover:bg-rose-500/20 tap-transparent"
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
              className="flex min-h-[32px] items-center gap-1 rounded-md px-2 py-1 text-[10px] text-slate-500 transition hover:bg-white/5 hover:text-slate-200 tap-transparent"
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
                className="flex min-h-[32px] items-center gap-1 rounded-md px-2 py-1 text-[10px] text-slate-500 transition hover:bg-white/5 hover:text-slate-200 tap-transparent"
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

export default MessageBubble
