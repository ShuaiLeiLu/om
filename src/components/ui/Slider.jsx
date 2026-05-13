'use client'

import { cn } from '@/lib/utils'

export function Slider({ value, onChange, min = 0, max = 100, step = 1, label, valueLabel, className }) {
  const percent = Math.max(0, Math.min(100, ((value - min) / (max - min || 1)) * 100))
  return (
    <div className={cn('w-full', className)}>
      {(label || valueLabel) && (
        <div className="mb-1.5 flex items-center justify-between text-[11px] text-slate-400">
          <span>{label}</span>
          <span className="font-mono text-slate-200">{valueLabel ?? value}</span>
        </div>
      )}
      <div className="relative flex h-5 items-center">
        <div className="absolute inset-x-0 h-1 rounded-full bg-white/8" />
        <div
          className="absolute h-1 rounded-full bg-gradient-to-r from-indigo-500 via-fuchsia-500 to-pink-500"
          style={{ width: `${percent}%` }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="relative z-10 h-5 w-full cursor-pointer appearance-none bg-transparent slider-input"
        />
      </div>
      <style jsx>{`
        .slider-input::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: white;
          border: 2px solid #a855f7;
          box-shadow: 0 0 12px rgba(168, 85, 247, 0.5);
          cursor: pointer;
        }
        .slider-input::-moz-range-thumb {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: white;
          border: 2px solid #a855f7;
          box-shadow: 0 0 12px rgba(168, 85, 247, 0.5);
          cursor: pointer;
        }
      `}</style>
    </div>
  )
}

export default Slider
