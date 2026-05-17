'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Pagination({ page, pageSize, count, onChange, hasMore }) {
  // 仅基于"当前页大小是否拿满"做下一页判断，因为后端没返回 total
  const canPrev = page > 1
  const canNext = hasMore != null ? hasMore : (count || 0) >= (pageSize || 20)

  return (
    <div className="flex items-center justify-between gap-3 pt-3 text-xs text-slate-400">
      <span>
        第 <span className="font-mono text-slate-200">{page}</span> 页 · 当前显示{' '}
        <span className="font-mono text-slate-200">{count}</span> 条
      </span>
      <div className="flex items-center gap-1.5">
        <PageBtn disabled={!canPrev} onClick={() => onChange(page - 1)}>
          <ChevronLeft size={13} /> 上一页
        </PageBtn>
        <PageBtn disabled={!canNext} onClick={() => onChange(page + 1)}>
          下一页 <ChevronRight size={13} />
        </PageBtn>
      </div>
    </div>
  )
}

function PageBtn({ disabled, onClick, children }) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'inline-flex min-h-[36px] items-center gap-1 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-xs text-slate-300 transition-all tap-transparent',
        !disabled && 'hover:bg-white/[0.08] hover:text-white',
        disabled && 'opacity-40 cursor-not-allowed'
      )}
    >
      {children}
    </button>
  )
}

export default Pagination
