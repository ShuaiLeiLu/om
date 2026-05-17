'use client'

import { cn } from '@/lib/utils'

export function Slider({
  label,
  valueLabel,
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  className
}) {
  return (
    <div className={cn('space-y-2', className)}>
      {(label || valueLabel !== undefined) && (
        <div className="flex items-center justify-between gap-3 text-[11px] text-slate-400">
          <span>{label}</span>
          <span className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 font-mono text-slate-200">
            {valueLabel ?? value}
          </span>
        </div>
      )}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange?.(Number(event.target.value))}
        className="slider-input w-full"
      />
    </div>
  )
}
