'use client'

import { useState } from 'react'
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
    <div className="card-glass !p-3 sm:!p-4">
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          提示词
        </span>
        {modelName && (
          <span className="chip-brand truncate max-w-[200px]">
            <Sparkles size={10} />
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
        rows={4}
        className="min-h-28 w-full resize-none rounded-lg bg-transparent p-2 text-[15px] text-white placeholder-slate-500 outline-none sm:min-h-32 sm:text-sm"
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
            e.preventDefault()
            if (prompt.trim() && !isGenerating) onGenerate?.()
          }
        }}
      />

      {error && (
        <div className="mt-2.5 flex items-center gap-2 rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
          <AlertCircle size={14} className="shrink-0" />
          <span className="flex-1 min-w-0">{error}</span>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className="hidden text-[10px] text-slate-500 sm:block">
          {hasRefs ? `已附加 ${refs.length} 张参考图` : '⌘/Ctrl + Enter 快速生成'}
        </p>
        <Button
          onClick={onGenerate}
          disabled={!prompt.trim() || isGenerating}
          variant="gradient"
          size="md"
          className={cn(
            'shrink-0 w-full min-h-[44px] sm:w-auto',
            isGenerating && 'pointer-events-none'
          )}
        >
          {isGenerating ? <Loader2 size={15} className="animate-spin" /> : <Wand2 size={15} />}
          {buttonLabel}
        </Button>
      </div>
    </div>
  )
}

export default PromptComposer
