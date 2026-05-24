'use client'

import { useEffect } from 'react'
import { useImageStore } from '@/store/useImageStore'
import { cn } from '@/lib/utils'
import {
  QUALITY_OPTIONS,
  FORMAT_OPTIONS,
  MODERATION_OPTIONS,
  imageCountLimitText,
  maxImagesForSize,
  normalizeImageCount
} from '@/lib/image/size'
import { Slider } from '@/components/ui/slider'
import { SizeSelector } from './SizeSelector'

export function ParamsPanel() {
  const params = useImageStore((s) => s.params)
  const sizePreset = useImageStore((s) => s.sizePreset)
  const setParam = useImageStore((s) => s.setParam)
  const setSizePreset = useImageStore((s) => s.setSizePreset)

  const compressionEnabled = params.output_format === 'jpeg' || params.output_format === 'webp'
  const maxCount = maxImagesForSize(params.size)
  const countHint = imageCountLimitText(params.size)

  useEffect(() => {
    const next = normalizeImageCount(params.n, params.size)
    if (next !== params.n) setParam('n', next)
  }, [params.n, params.size, setParam])

  return (
    <div className="space-y-4">
      <div className="mb-1 flex items-center justify-between">
        <h3 className="font-serif text-base font-semibold text-ink-900">参数 · 调和</h3>
        <span className="chip-ink chip text-[10px]">已调整</span>
      </div>

      <div>
        <Label>尺寸</Label>
        <SizeSelector
          value={params.size}
          onChange={(v) => setParam('size', v)}
          preset={sizePreset}
          onPresetChange={setSizePreset}
        />
      </div>

      <div>
        <Label>质量</Label>
        <SegGroup
          options={QUALITY_OPTIONS}
          value={params.quality}
          onChange={(v) => setParam('quality', v)}
        />
      </div>

      <div>
        <Label>格式</Label>
        <SegGroup
          options={FORMAT_OPTIONS}
          value={params.output_format}
          onChange={(v) => setParam('output_format', v)}
        />
      </div>

      <div className={cn(!compressionEnabled && 'opacity-40 pointer-events-none transition-opacity duration-300')}>
        <Slider
          min={0}
          max={100}
          step={1}
          label={`压缩率${compressionEnabled ? '' : '（仅 JPEG / WebP）'}`}
          valueLabel={params.output_compression}
          value={params.output_compression}
          onChange={(v) => setParam('output_compression', v)}
        />
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <Label className="mb-0">内容审核</Label>
          <span className="chip text-[10px] py-0 px-1.5">已开启</span>
        </div>
        <SegGroup
          options={MODERATION_OPTIONS}
          value={params.moderation}
          onChange={(v) => setParam('moderation', v)}
        />
      </div>

      <div>
        <Label>生成数量</Label>
        <div className="flex items-center gap-2.5">
          <input
            type="range"
            min={1}
            max={maxCount}
            step={1}
            value={normalizeImageCount(params.n, params.size)}
            onChange={(e) => setParam('n', normalizeImageCount(Number(e.target.value), params.size))}
            className="flex-1"
          />
          <div className="flex h-8 w-10 shrink-0 items-center justify-center rounded-lg border border-ink-700/10 bg-rice-50 text-xs font-mono font-semibold text-ink-700">
            {normalizeImageCount(params.n, params.size)}
          </div>
        </div>
        {countHint && <p className="mt-1.5 text-[10px] text-gold-600">{countHint}</p>}
      </div>

      <div className="rounded-2xl border border-ink-700/10 bg-rice-100 px-3 py-2.5 text-[10px] leading-relaxed text-ink-500">
        系统会自动过滤违反《生成式人工智能服务管理暂行办法》的内容，生成前请确认提示词不含违法违规内容。
      </div>
    </div>
  )
}

function Label({ children, className }) {
  return (
    <p className={cn('mb-1.5 text-[10px] text-ink-500 label-zh', className)}>
      {children}
    </p>
  )
}

function SegGroup({ options, value, onChange }) {
  return (
    <div className="grid grid-flow-col gap-1 rounded-xl border border-ink-700/10 bg-rice-200/70 p-1">
      {options.map((opt) => {
        const active = value === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              'rounded-lg px-2 py-1.5 text-[11px] font-semibold transition-all duration-300 active:scale-[0.96]',
              active
                ? 'bg-rice-50 text-celadon-700 shadow-[var(--shadow-paper)] border border-ink-700/5'
                : 'text-ink-500 hover:text-ink-900 border border-transparent'
            )}
            title={opt.description}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

export default ParamsPanel
