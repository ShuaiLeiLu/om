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

      <div className={cn(!compressionEnabled && 'opacity-40 pointer-events-none')}>
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
        <Label>审核强度</Label>
        <SegGroup
          options={MODERATION_OPTIONS}
          value={params.moderation}
          onChange={(v) => setParam('moderation', v)}
        />
      </div>

      <div>
        <Label>生成数量</Label>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={1}
            max={maxCount}
            step={1}
            value={normalizeImageCount(params.n, params.size)}
            onChange={(e) => setParam('n', normalizeImageCount(Number(e.target.value), params.size))}
            className="flex-1 slider-input"
          />
          <div className="flex h-8 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-sm font-mono text-white">
            {normalizeImageCount(params.n, params.size)}
          </div>
        </div>
        {countHint && <p className="mt-1.5 text-[10px] text-amber-200/80">{countHint}</p>}
      </div>
    </div>
  )
}

function Label({ children }) {
  return (
    <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
      {children}
    </p>
  )
}

function SegGroup({ options, value, onChange }) {
  return (
    <div className="grid grid-flow-col gap-1 rounded-xl border border-white/8 bg-white/[0.04] p-1">
      {options.map((opt) => {
        const active = value === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              'rounded-lg px-2 py-1.5 text-xs font-medium transition-all',
              active
                ? 'bg-gradient-to-br from-indigo-500/60 to-purple-500/50 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.15)] border border-white/15'
                : 'text-slate-400 hover:text-slate-200 border border-transparent'
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
