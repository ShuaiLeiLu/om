'use client'

import { Loader2, AlertCircle, Wand2 } from 'lucide-react'
import { useImageStore } from '@/store/useImageStore'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

const STYLE_CHIPS = ['国画风', '工笔', '水墨', '极简', '写实']

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
    <div className="relative rounded-[28px] border border-ink-700/10 bg-rice-50 p-4 sm:p-5 shadow-[var(--shadow-paper)] transition-all duration-300 ricepaper">
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="text-[10px] text-ink-500 label-zh">
          提 示 词
        </span>
        {modelName && (
          <span className="inline-flex items-center gap-1 rounded-full border border-celadon-600/15 bg-celadon-50 px-2.5 py-0.5 text-[10px] font-mono text-celadon-700">
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
        className="min-h-20 w-full resize-none rounded-2xl bg-rice-50 border border-ink-700/10 p-3 text-[16px] sm:text-sm text-ink-900 placeholder-ink-400 outline-none transition-all duration-300 focus:border-celadon-500/45 focus:bg-white sm:min-h-28"
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
            e.preventDefault()
            if (prompt.trim() && !isGenerating) onGenerate?.()
          }
        }}
      />

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {STYLE_CHIPS.map((style) => (
          <button
            key={style}
            type="button"
            onClick={() => {
              const suffix = `，${style}`
              setPrompt(prompt.trim() ? `${prompt.trim()}${suffix}` : style)
            }}
            className="chip-ink chip text-[11px] transition hover:border-celadon-600/20 hover:text-celadon-700"
          >
            + {style}
          </button>
        ))}
      </div>

      {error && (
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-verm-500/25 bg-verm-500/10 px-3 py-2 text-xs text-verm-600">
          <AlertCircle size={14} className="shrink-0" />
          <span className="flex-1 min-w-0">{error}</span>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="hidden text-[10px] text-ink-500 sm:block">
          {hasRefs ? `已附加 ${refs.length} 张参考图` : '⌘/Ctrl + Enter 快速生成'}
        </p>
        <div className="relative shrink-0 w-full sm:w-auto group">
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
