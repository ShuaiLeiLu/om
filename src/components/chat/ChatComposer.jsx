'use client'

import { useRef } from 'react'
import { ImagePlus, X, Send, Loader2, CornerDownLeft, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

// Mobile-first chat composer. On small screens it removes desktop hints,
// expands touch targets, and respects iOS safe-area bottom inset.
export function ChatComposer({
  value,
  onChange,
  onSend,
  isLoading,
  pendingImages,
  onAddImages,
  onRemoveImage,
  modelName,
  disabled
}) {
  const fileInputRef = useRef(null)
  const textareaRef = useRef(null)

  const hasContent = value.trim().length > 0 || pendingImages.length > 0
  const charCount = value.length

  const handleKey = (e) => {
    // Enter to send only on devices with a physical keyboard / large screens.
    // On mobile we always allow Enter to insert newline (use Send button instead).
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      const isFinePointer =
        typeof window !== 'undefined' &&
        window.matchMedia &&
        window.matchMedia('(pointer: fine)').matches
      if (isFinePointer) {
        e.preventDefault()
        if (hasContent && !isLoading && !disabled) onSend()
      }
    }
  }

  const handleInput = (e) => {
    onChange(e.target.value)
    const el = textareaRef.current
    if (el) {
      el.style.height = 'auto'
      el.style.height = Math.min(el.scrollHeight, 240) + 'px'
    }
  }

  return (
    <div className="shrink-0 bg-gradient-to-t from-slate-950 via-slate-950/95 to-slate-950/30 px-3 pb-2 pt-4 pl-safe pr-safe pb-safe sm:px-4 sm:pt-6 sm:pb-4">
      <div className="mx-auto max-w-3xl">
        {pendingImages.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2 px-1">
            {pendingImages.map((img, i) => (
              <div key={i} className="group relative">
                <img
                  src={img}
                  className="h-16 w-16 rounded-xl object-cover border border-white/10 shadow-lg"
                  alt=""
                />
                <button
                  onClick={() => onRemoveImage(i)}
                  className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-rose-500 text-white shadow-lg transition-transform active:scale-90 tap-transparent"
                  aria-label="移除"
                >
                  <X size={11} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div
          className={cn(
            'relative flex flex-col gap-1 rounded-3xl border bg-slate-900/60 backdrop-blur-2xl transition-all duration-200',
            'shadow-[0_8px_32px_rgba(0,0,0,0.3)]',
            'border-white/10 focus-within:border-indigo-400/50 focus-within:bg-slate-900/80',
            'focus-within:shadow-[0_8px_32px_rgba(99,102,241,0.18),0_0_0_3px_rgba(99,102,241,0.12)]'
          )}
        >
          <textarea
            ref={textareaRef}
            value={value}
            onChange={handleInput}
            onKeyDown={handleKey}
            disabled={disabled}
            placeholder="问点什么..."
            rows={1}
            inputMode="text"
            enterKeyHint="send"
            className={cn(
              'max-h-60 w-full resize-none bg-transparent px-4 pt-3.5 pb-1 text-[16px] sm:text-[15px] text-white placeholder-slate-500 outline-none scrollbar-thin disabled:cursor-not-allowed disabled:opacity-50',
              'sm:px-5 sm:pt-4'
            )}
          />

          {/* toolbar */}
          <div className="flex items-end justify-between gap-2 px-1.5 pb-1.5 pt-1 sm:px-2 sm:pb-2">
            <div className="flex min-w-0 items-center gap-1">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={disabled}
                className="flex h-10 items-center gap-1.5 rounded-xl px-2.5 text-slate-400 transition hover:bg-white/5 hover:text-slate-200 disabled:opacity-50 active:scale-95 tap-transparent"
                aria-label="附加图片"
              >
                <ImagePlus size={17} />
                <span className="hidden sm:inline text-xs">图片</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  onAddImages(Array.from(e.target.files || []))
                  e.target.value = ''
                }}
              />
              {modelName && (
                <div className="hidden md:flex items-center gap-1 rounded-lg bg-white/5 px-2 py-1 text-[10px] text-slate-400">
                  <Sparkles size={9} className="text-fuchsia-300" />
                  <span className="truncate max-w-[160px] font-mono">{modelName}</span>
                </div>
              )}
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
              {charCount > 0 && (
                <span className="hidden md:inline-block text-[10px] font-mono text-slate-500">
                  {charCount.toLocaleString()}
                </span>
              )}
              <div className="hidden md:flex items-center gap-1 rounded-md border border-white/5 bg-white/[0.02] px-1.5 py-1 text-[9px] text-slate-500">
                <CornerDownLeft size={9} />
                <span>发送</span>
              </div>
              <button
                onClick={onSend}
                disabled={!hasContent || isLoading || disabled}
                className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-xl transition-all tap-transparent',
                  hasContent && !isLoading && !disabled
                    ? 'bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-white shadow-[0_6px_20px_rgba(99,102,241,0.45)] hover:brightness-110 active:scale-95'
                    : 'bg-white/5 text-slate-600 cursor-not-allowed'
                )}
                aria-label="发送"
              >
                {isLoading ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Send size={16} />
                )}
              </button>
            </div>
          </div>
        </div>

        <p className="mt-2 hidden text-center text-[10px] text-slate-600 sm:block">
          AI 可能生成不准确的信息，请核实重要内容 · Shift + Enter 换行
        </p>
      </div>
    </div>
  )
}

export default ChatComposer
