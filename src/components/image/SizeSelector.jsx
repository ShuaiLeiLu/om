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
        className="flex w-full items-center justify-between rounded-xl border border-ink-700/10 bg-rice-50 px-3 py-2 text-left text-sm text-ink-900 transition hover:bg-rice-100"
      >
        <span className="flex items-center gap-2">
          <Maximize2 size={14} className="text-ink-500" />
          <span>{describeSize(value)}</span>
        </span>
        <span className="text-[10px] uppercase tracking-wider text-ink-500">点击调整</span>
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
                  ? 'border-ink-700/5 bg-rice-50 text-celadon-700 shadow-[var(--shadow-paper)]'
                  : 'border-ink-700/10 bg-rice-100 text-ink-500 hover:text-ink-900'
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
                      ? 'border-celadon-600/30 bg-celadon-50 text-celadon-800'
                      : 'border-ink-700/10 bg-rice-50 text-ink-700 hover:bg-rice-100'
                  )}
                >
                  <span>
                    <span className="block text-sm font-semibold">{option.label}</span>
                    <span className="mt-0.5 block text-xs text-ink-500">{option.description}</span>
                  </span>
                  {active && <Check size={16} className="text-celadon-700" />}
                </button>
              )
            })}
          </div>
        )}

        {mode === 'preset' && (
          <div className="space-y-4">
            <div>
              <p className="mb-2 text-[11px] text-ink-500 label-zh">目 标</p>
              <div className="grid grid-cols-4 gap-2">
                {TARGET_KEYS.map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setTarget(key)}
                    className={cn(
                      'rounded-lg border px-3 py-2 text-sm font-medium transition',
                      target === key
                        ? 'border-celadon-600/30 bg-celadon-50 text-celadon-800'
                        : 'border-ink-700/10 bg-rice-50 text-ink-700 hover:bg-rice-100'
                    )}
                  >
                    {key === 'auto' ? 'Auto' : key}
                  </button>
                ))}
              </div>
              {target !== 'auto' && (
                <p className="mt-1.5 text-[10px] text-ink-500">
                  约 {(TARGET_PIXELS[target] / 1_000_000).toFixed(1)} MP
                </p>
              )}
            </div>

            {target !== 'auto' && (
              <div>
                <p className="mb-2 text-[11px] text-ink-500 label-zh">比 例</p>
                <div className="grid grid-cols-4 gap-2">
                  {ASPECT_RATIOS.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setAspect(item.id)}
                      className={cn(
                      'rounded-lg border px-3 py-2 text-sm font-medium transition',
                      aspect === item.id
                        ? 'border-celadon-600/30 bg-celadon-50 text-celadon-800'
                        : 'border-ink-700/10 bg-rice-50 text-ink-700 hover:bg-rice-100'
                      )}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-xl border border-celadon-600/15 bg-celadon-50 p-4">
              <p className="text-[11px] text-celadon-700 label-zh">将 生 成</p>
              <p className="mt-1 text-xl font-semibold text-ink-900">{computed.label}</p>
            </div>
          </div>
        )}

        {mode === 'custom' && (
          <div className="space-y-3">
            <p className="text-xs text-ink-500">宽高需为 16 的倍数，比例 1:3 到 3:1，最高 3840 × 2160。</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="mb-1 text-[11px] text-ink-500 label-zh">宽 W</p>
                <input
                  type="number"
                  min={16}
                  max={3840}
                  step={16}
                  value={customW}
                  onChange={(e) => setCustomW(e.target.value)}
                  placeholder="3840"
                  className="h-10 w-full rounded-xl border border-ink-700/10 bg-rice-50 px-3 text-sm text-ink-900 outline-none focus:border-celadon-500/45"
                />
              </div>
              <div>
                <p className="mb-1 text-[11px] text-ink-500 label-zh">高 H</p>
                <input
                  type="number"
                  min={16}
                  max={3840}
                  step={16}
                  value={customH}
                  onChange={(e) => setCustomH(e.target.value)}
                  placeholder="2160"
                  className="h-10 w-full rounded-xl border border-ink-700/10 bg-rice-50 px-3 text-sm text-ink-900 outline-none focus:border-celadon-500/45"
                />
              </div>
            </div>
            {customValue && (
              <p className={cn('text-[10px]', customValid ? 'text-ink-500' : 'text-verm-600')}>
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
