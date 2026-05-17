'use client'

// AdminSelect → 内部完全使用 shadcn Select（Radix UI 实现）。
// 保留旧 API（value/onChange/options/emptyLabel）方便所有 tab 不用改。
import * as React from 'react'
import {
  Select as ShadcnSelect,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

export function AdminSelect({
  value,
  onChange,
  options = [],
  placeholder,
  allowEmpty = true,
  emptyLabel = '全部',
  size = 'md',
  disabled = false,
  className,
  width = 'auto'
}) {
  // Radix Select 不接受空字符串作为 value（会抛错），用一个 sentinel 表示空
  const EMPTY = '__ALL__'
  const v = value == null || value === '' ? EMPTY : String(value)
  const handleChange = (next) => onChange?.(next === EMPTY ? '' : next)

  const heightClass = {
    sm: 'h-8 text-[11px]',
    md: 'h-9 text-xs',
    lg: 'h-10 text-sm'
  }[size]

  const items = allowEmpty ? [{ value: EMPTY, label: emptyLabel }, ...options] : options

  return (
    <ShadcnSelect value={v} onValueChange={handleChange} disabled={disabled}>
      <SelectTrigger
        className={cn(heightClass, className)}
        style={width === 'full' ? undefined : width !== 'auto' ? { width } : undefined}
      >
        <SelectValue placeholder={placeholder || emptyLabel} />
      </SelectTrigger>
      <SelectContent>
        {items.map((opt) => (
          <SelectItem
            key={opt.value === '' ? '__empty__' : opt.value}
            value={String(opt.value)}
            disabled={opt.disabled}
          >
            <div className="flex min-w-0 flex-col text-left">
              <span className="truncate">{opt.label}</span>
              {opt.hint && (
                <span className="truncate text-[10px] text-muted-foreground">{opt.hint}</span>
              )}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </ShadcnSelect>
  )
}

export default AdminSelect
