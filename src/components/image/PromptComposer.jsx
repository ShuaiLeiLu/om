'use client'

import { Sparkles, Loader2, AlertCircle, Wand2 } from 'lucide-react'
import { useImageStore } from '@/store/useImageStore'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

export function PromptComposer({ onGenerate, isGenerating, modelName, error }) {
  const prompt = useImageStore((s) => s.prompt)
  const setPrompt = useImageStore((s) => s.setPrompt)
  const refs = useImageStore((s) => s.refs)

  const hasRefs = refs.length > 0
  const buttonLabel = isGenerating
    ? '生成中...'
    : hasRefs
      ? '使用参考图生成'
      : '生成图片'

  return (
    <div className="relative rounded-3xl border border-white/5 bg-slate-900/40 p-4 backdrop-blur-xl sm:p-5 shadow-[0_8px_32px_rgba(0,0,0,0.3)] transition-all duration-300 hover:border-white/10 hover:bg-slate-900/50">
      {/* Light glow reflection inside prompt panel */}
      <div className="absolute -left-12 -top-12 h-36 w-36 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
      
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          提示词
        </span>
        {modelName && (
          <span className="inline-flex items-center gap-1 rounded-full border border-indigo-500/25 bg-indigo-500/10 px-2.5 py-0.5 text-[10px] font-mono text-indigo-300">
            <Sparkles size={9} className="text-indigo-400" />
            {modelName}
          </span>
        )}
      </div>

      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder={
          hasRefs
            ? '描述你想如何编辑参考图...'
            : '描述你想生成的画面，比如：一只穿着宇航服的橘猫漂浮在土星环旁'
        }
        rows={3}
        className="min-h-20 w-full resize-none rounded-2xl bg-white/[0.015] border border-white/5 p-3 text-sm text-white placeholder-slate-500 outline-none transition-all duration-300 focus:border-indigo-500/20 focus:bg-white/[0.03] sm:min-h-28"
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
            e.preventDefault()
            if (prompt.trim() && !isGenerating) onGenerate?.()
          }
        }}
      />

      {error && (
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-rose-400/25 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
          <AlertCircle size={14} className="shrink-0" />
          <span className="flex-1 min-w-0">{error}</span>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="hidden text-[10px] text-slate-500 sm:block">
          {hasRefs ? `已附加 ${refs.length} 张参考图` : '⌘/Ctrl + Enter 快速生成'}
        </p>
        <div className="relative shrink-0 w-full sm:w-auto group">
          {/* Double-layer underlying glowing shadow */}
          {!isGenerating && prompt.trim() && (
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 via-purple-500 to-fuchsia-500 rounded-xl blur-md opacity-60 transition-all duration-300 group-hover:opacity-85 group-hover:blur-lg pointer-events-none" />
          )}
          <Button
            onClick={onGenerate}
            disabled={!prompt.trim() || isGenerating}
            variant="gradient"
            size="md"
            className={cn(
              'relative z-10 shrink-0 w-full min-h-[42px] sm:min-h-[44px] sm:w-auto font-semibold active:scale-[0.96] transition-all duration-300 hover:scale-[1.02]',
              isGenerating && 'pointer-events-none'
            )}
          >
            {isGenerating ? <Loader2 size={15} className="animate-spin" /> : <Wand2 size={15} />}
            {buttonLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}

export default PromptComposer
