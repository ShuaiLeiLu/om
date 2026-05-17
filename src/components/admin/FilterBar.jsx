'use client'

import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

export function FilterBar({
  children,
  search,
  onSearchChange,
  searchPlaceholder = '搜索...',
  className
}) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-2 rounded-2xl border bg-card/30 p-2 backdrop-blur-xl',
        className
      )}
    >
      {onSearchChange != null && (
        <div className="relative flex-1 min-w-[180px]">
          <Search
            size={13}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={search || ''}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="h-9 pl-9 text-xs"
          />
        </div>
      )}
      {children}
    </div>
  )
}

// 兼容旧调用：value/onChange/options/label —— 内部转 shadcn Select
const EMPTY = '__ALL__'
export function FilterSelect({ value, onChange, options, label = '全部', width = '160px' }) {
  const v = value == null || value === '' ? EMPTY : String(value)
  return (
    <Select value={v} onValueChange={(next) => onChange?.(next === EMPTY ? '' : next)}>
      <SelectTrigger className="h-9 text-xs" style={{ width }}>
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={EMPTY}>{label}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={String(o.value)}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export default FilterBar
