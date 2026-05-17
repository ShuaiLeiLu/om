'use client'

import { useEffect, useState } from 'react'
import { Check, Maximize2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  ASPECT_RATIOS,
  TARGET_PIXELS,
  POPULAR_IMAGE_SIZES,
  computePresetSize,
  detectPreset,
  describeSize,
  isValidImageSize,
  parseSize,
  snapDownToMultipleOf16
} from '@/lib/image/size'
import { Button } from '@/components/ui/button'
import { Dialog, DialogHeader, DialogBody, DialogFooter } from '@/components/ui/dialog'

const TARGET_KEYS = ['auto', '1K', '2K', '4K']

export function SizeSelector({ value, onChange, preset, onPresetChange }) {
  const [open, setOpen] = useState(false)

  const handleOpen = () => {
    onPresetChange?.(detectPreset(value))
    setOpen(true)
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-left text-sm text-white transition hover:bg-white/[0.06]"
      >
        <span className="flex items-center gap-2">
          <Maximize2 size={14} className="text-slate-400" />
          <span>{describeSize(value)}</span>
        </span>
        <span className="text-[10px] uppercase tracking-wider text-slate-500">点击调整</span>
      </button>

      <SizeDialog
        open={open}
        onClose={() => setOpen(false)}
        value={value}
        onChange={onChange}
        preset={preset}
        onPresetChange={onPresetChange}
      />
    </>
  )
}

function SizeDialog({ open, onClose, value, onChange, preset, onPresetChange }) {
  const [target, setTarget] = useState(preset?.target || '1K')
  const [aspect, setAspect] = useState(preset?.aspect || '1:1')
  const [customW, setCustomW] = useState('')
  const [customH, setCustomH] = useState('')
  const [mode, setMode] = useState('preset')
  const [selectedPopular, setSelectedPopular] = useState('')

  useEffect(() => {
    if (!open) return
    const detected = detectPreset(value)
    setTarget(detected.target || '1K')
    setAspect(detected.aspect || '1:1')
    const parsed = parseSize(value)
    setCustomW(parsed.mode === 'fixed' ? String(parsed.w) : '')
    setCustomH(parsed.mode === 'fixed' ? String(parsed.h) : '')
    setSelectedPopular(POPULAR_IMAGE_SIZES.some((item) => item.value === value) ? value : '')
    setMode('preset')
  }, [open, value])

  const computed = computePresetSize(target, aspect)
  const customValue = customW && customH
    ? `${snapDownToMultipleOf16(Number(customW) || 0)}x${snapDownToMultipleOf16(Number(customH) || 0)}`
    : ''
  const customValid = customValue ? isValidImageSize(customValue) : false

  const applySize = (nextValue) => {
    onChange?.(nextValue)
    onPresetChange?.(detectPreset(nextValue))
    onClose?.()
  }

  const handleConfirm = () => {
    if (mode === 'popular' && selectedPopular) {
      applySize(selectedPopular)
      return
    }
    if (mode === 'custom') {
      applySize(customValid ? customValue : '1024x1024')
      return
    }
    applySize(computed.value)
  }

  return (
    <Dialog open={open} onClose={onClose} size="md">
      <DialogHeader
        title="选择尺寸"
        description="GPT Image 2 支持最高 3840 × 2160 的 16 倍数尺寸"
        onClose={onClose}
      />
      <DialogBody>
        <div className="mb-4 grid grid-cols-3 gap-2">
          {[
            { id: 'popular', label: '热门' },
            { id: 'preset', label: '预设' },
            { id: 'custom', label: '自定义' }
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setMode(item.id)}
              className={cn(
                'rounded-lg border px-3 py-2 text-xs font-medium transition',
                mode === item.id
                  ? 'border-white/15 bg-gradient-to-br from-indigo-500/40 to-purple-500/30 text-white'
                  : 'border-white/5 bg-white/5 text-slate-400 hover:text-slate-200'
              )}
            >
              {item.label}
            </button>
          ))}
        </div>

        {mode === 'popular' && (
          <div className="grid gap-2">
            {POPULAR_IMAGE_SIZES.map((option) => {
              const active = selectedPopular === option.value
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setSelectedPopular(option.value)}
                  className={cn(
                    'flex min-h-[56px] items-center justify-between rounded-xl border px-3 py-2 text-left transition',
                    active
                      ? 'border-fuchsia-400/45 bg-fuchsia-500/18 text-white'
                      : 'border-white/8 bg-white/[0.04] text-slate-300 hover:bg-white/[0.07]'
                  )}
                >
                  <span>
                    <span className="block text-sm font-semibold">{option.label}</span>
                    <span className="mt-0.5 block text-xs text-slate-500">{option.description}</span>
                  </span>
                  {active && <Check size={16} className="text-fuchsia-200" />}
                </button>
              )
            })}
          </div>
        )}

        {mode === 'preset' && (
          <div className="space-y-4">
            <div>
              <p className="mb-2 text-[11px] uppercase tracking-wider text-slate-500">目标</p>
              <div className="grid grid-cols-4 gap-2">
                {TARGET_KEYS.map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setTarget(key)}
                    className={cn(
                      'rounded-lg border px-3 py-2 text-sm font-medium transition',
                      target === key
                        ? 'border-indigo-400/40 bg-indigo-500/20 text-indigo-100'
                        : 'border-white/5 bg-white/5 text-slate-300 hover:bg-white/10'
                    )}
                  >
                    {key === 'auto' ? 'Auto' : key}
                  </button>
                ))}
              </div>
              {target !== 'auto' && (
                <p className="mt-1.5 text-[10px] text-slate-500">
                  约 {(TARGET_PIXELS[target] / 1_000_000).toFixed(1)} MP
                </p>
              )}
            </div>

            {target !== 'auto' && (
              <div>
                <p className="mb-2 text-[11px] uppercase tracking-wider text-slate-500">比例</p>
                <div className="grid grid-cols-4 gap-2">
                  {ASPECT_RATIOS.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setAspect(item.id)}
                      className={cn(
                        'rounded-lg border px-3 py-2 text-sm font-medium transition',
                        aspect === item.id
                          ? 'border-fuchsia-400/40 bg-fuchsia-500/20 text-fuchsia-100'
                          : 'border-white/5 bg-white/5 text-slate-300 hover:bg-white/10'
                      )}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-xl border border-white/8 bg-gradient-to-br from-indigo-500/5 to-fuchsia-500/5 p-4">
              <p className="text-[11px] uppercase tracking-wider text-slate-500">将生成</p>
              <p className="mt-1 text-xl font-semibold text-white">{computed.label}</p>
            </div>
          </div>
        )}

        {mode === 'custom' && (
          <div className="space-y-3">
            <p className="text-xs text-slate-400">宽高需为 16 的倍数，比例 1:3 到 3:1，最高 3840 × 2160。</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="mb-1 text-[11px] uppercase tracking-wider text-slate-500">宽 W</p>
                <input
                  type="number"
                  min={16}
                  max={3840}
                  step={16}
                  value={customW}
                  onChange={(e) => setCustomW(e.target.value)}
                  placeholder="3840"
                  className="input-glass"
                />
              </div>
              <div>
                <p className="mb-1 text-[11px] uppercase tracking-wider text-slate-500">高 H</p>
                <input
                  type="number"
                  min={16}
                  max={3840}
                  step={16}
                  value={customH}
                  onChange={(e) => setCustomH(e.target.value)}
                  placeholder="2160"
                  className="input-glass"
                />
              </div>
            </div>
            {customValue && (
              <p className={cn('text-[10px]', customValid ? 'text-slate-500' : 'text-rose-300')}>
                实际生成：{customValue.replace('x', ' × ')}
                {!customValid && '，不符合 image2 尺寸范围，将回退到 1024 × 1024'}
              </p>
            )}
          </div>
        )}
      </DialogBody>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose} size="sm">取消</Button>
        <Button variant="gradient" onClick={handleConfirm} size="sm">
          <Check size={14} /> 应用
        </Button>
      </DialogFooter>
    </Dialog>
  )
}

export default SizeSelector
