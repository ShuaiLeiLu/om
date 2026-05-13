'use client'

import { useState, useEffect, useRef } from 'react'
import { Maximize2, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  ASPECT_RATIOS,
  TARGET_PIXELS,
  computePresetSize,
  parseSize,
  snapDownToMultipleOf16,
  detectPreset,
  describeSize
} from '@/lib/image/size'
import { Button } from '@/components/ui/Button'
import { Dialog, DialogHeader, DialogBody, DialogFooter } from '@/components/ui/Dialog'

const TARGET_KEYS = ['auto', '1K', '2K', '4K']

export function SizeSelector({ value, onChange, preset, onPresetChange }) {
  const [open, setOpen] = useState(false)

  const handleOpen = () => {
    // when reopening, reverse-detect the preset that best matches current value
    if (value && value !== 'auto') {
      const detected = detectPreset(value)
      onPresetChange?.(detected)
    } else {
      onPresetChange?.({ target: 'auto', aspect: preset?.aspect || '1:1' })
    }
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
        <span className="text-[10px] text-slate-500 uppercase tracking-wider">点击调整</span>
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
  const [target, setTarget] = useState(preset?.target || 'auto')
  const [aspect, setAspect] = useState(preset?.aspect || '1:1')
  const [customW, setCustomW] = useState('')
  const [customH, setCustomH] = useState('')
  const [mode, setMode] = useState('preset') // 'preset' | 'custom'

  useEffect(() => {
    if (!open) return
    setTarget(preset?.target || 'auto')
    setAspect(preset?.aspect || '1:1')
    const p = parseSize(value)
    if (p.mode === 'fixed') {
      setCustomW(String(p.w))
      setCustomH(String(p.h))
    } else {
      setCustomW('')
      setCustomH('')
    }
    setMode('preset')
  }, [open, value, preset])

  const computed = computePresetSize(target, aspect)

  const handleConfirm = () => {
    if (mode === 'custom') {
      const w = snapDownToMultipleOf16(Number(customW) || 0)
      const h = snapDownToMultipleOf16(Number(customH) || 0)
      if (!w || !h) {
        onChange?.('auto')
      } else {
        onChange?.(`${w}x${h}`)
        onPresetChange?.(detectPreset(`${w}x${h}`))
      }
    } else {
      onChange?.(computed.value)
      onPresetChange?.({ target, aspect })
    }
    onClose?.()
  }

  return (
    <Dialog open={open} onClose={onClose} size="md">
      <DialogHeader title="选择尺寸" description="按 1K / 2K / 4K 与比例自动计算分辨率，也可手动输入（自动向下规整到 16 倍数）" onClose={onClose} />
      <DialogBody>
        <div className="mb-4 flex gap-2">
          <button
            onClick={() => setMode('preset')}
            className={cn(
              'flex-1 rounded-lg px-3 py-2 text-xs font-medium transition',
              mode === 'preset'
                ? 'bg-gradient-to-br from-indigo-500/40 to-purple-500/30 text-white border border-white/15'
                : 'bg-white/5 text-slate-400 border border-white/5'
            )}
          >
            预设
          </button>
          <button
            onClick={() => setMode('custom')}
            className={cn(
              'flex-1 rounded-lg px-3 py-2 text-xs font-medium transition',
              mode === 'custom'
                ? 'bg-gradient-to-br from-indigo-500/40 to-purple-500/30 text-white border border-white/15'
                : 'bg-white/5 text-slate-400 border border-white/5'
            )}
          >
            自定义
          </button>
        </div>

        {mode === 'preset' ? (
          <div className="space-y-4">
            <div>
              <p className="mb-2 text-[11px] uppercase tracking-wider text-slate-500">目标分辨率</p>
              <div className="grid grid-cols-4 gap-2">
                {TARGET_KEYS.map((k) => (
                  <button
                    key={k}
                    onClick={() => setTarget(k)}
                    className={cn(
                      'rounded-lg px-3 py-2 text-sm font-medium transition border',
                      target === k
                        ? 'bg-indigo-500/20 text-indigo-100 border-indigo-400/40'
                        : 'bg-white/5 text-slate-300 border-white/5 hover:bg-white/10'
                    )}
                  >
                    {k === 'auto' ? 'Auto' : k}
                  </button>
                ))}
              </div>
              {target !== 'auto' && (
                <p className="mt-1.5 text-[10px] text-slate-500">≈ {(TARGET_PIXELS[target] / 1_000_000).toFixed(1)} M 像素</p>
              )}
            </div>

            {target !== 'auto' && (
              <div>
                <p className="mb-2 text-[11px] uppercase tracking-wider text-slate-500">宽高比</p>
                <div className="grid grid-cols-4 gap-2">
                  {ASPECT_RATIOS.map((a) => (
                    <button
                      key={a.id}
                      onClick={() => setAspect(a.id)}
                      className={cn(
                        'rounded-lg px-3 py-2 text-sm font-medium transition border',
                        aspect === a.id
                          ? 'bg-fuchsia-500/20 text-fuchsia-100 border-fuchsia-400/40'
                          : 'bg-white/5 text-slate-300 border-white/5 hover:bg-white/10'
                      )}
                    >
                      {a.label}
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
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-slate-400">输入宽高（像素），会自动向下规整为 16 的倍数。范围 256–4096。</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="mb-1 text-[11px] uppercase tracking-wider text-slate-500">宽 W</p>
                <input
                  type="number"
                  min={256}
                  max={4096}
                  step={16}
                  value={customW}
                  onChange={(e) => setCustomW(e.target.value)}
                  placeholder="1024"
                  className="input-glass"
                />
              </div>
              <div>
                <p className="mb-1 text-[11px] uppercase tracking-wider text-slate-500">高 H</p>
                <input
                  type="number"
                  min={256}
                  max={4096}
                  step={16}
                  value={customH}
                  onChange={(e) => setCustomH(e.target.value)}
                  placeholder="1024"
                  className="input-glass"
                />
              </div>
            </div>
            {customW && customH && (
              <p className="text-[10px] text-slate-500">
                实际生成：{snapDownToMultipleOf16(Number(customW) || 0)} × {snapDownToMultipleOf16(Number(customH) || 0)}
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
