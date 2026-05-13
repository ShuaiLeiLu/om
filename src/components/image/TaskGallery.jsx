'use client'

import { Search, Filter } from 'lucide-react'
import { useImageStore } from '@/store/useImageStore'
import { useMemo } from 'react'
import { TaskCard } from './TaskCard'
import { cn } from '@/lib/utils'

const FILTERS = [
  { value: 'all', label: '全部' },
  { value: 'done', label: '已完成' },
  { value: 'running', label: '生成中' },
  { value: 'failed', label: '失败' }
]

export function TaskGallery({ onSelect }) {
  const taskIndex = useImageStore((s) => s.taskIndex)
  const filter = useImageStore((s) => s.filter)
  const search = useImageStore((s) => s.search)
  const setFilter = useImageStore((s) => s.setFilter)
  const setSearch = useImageStore((s) => s.setSearch)

  const filtered = useMemo(() => {
    let list = taskIndex
    if (filter !== 'all') {
      list = list.filter((t) => {
        if (filter === 'running') return t.status === 'running' || t.status === 'pending'
        if (filter === 'done') return t.status === 'done'
        if (filter === 'failed') return t.status === 'failed'
        return true
      })
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter((t) => (t.prompt || '').toLowerCase().includes(q))
    }
    return list
  }, [taskIndex, filter, search])

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索提示词..."
            className="input-glass pl-9"
          />
        </div>

        <div className="inline-flex items-center gap-1 rounded-xl border border-white/8 bg-white/[0.04] p-1">
          {FILTERS.map((f) => {
            const active = filter === f.value
            return (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-[11px] font-medium transition-all',
                  active
                    ? 'bg-gradient-to-br from-indigo-500/60 to-purple-500/50 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.15)] border border-white/15'
                    : 'text-slate-400 hover:text-slate-200 border border-transparent'
                )}
              >
                {f.label}
              </button>
            )
          })}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="card-glass flex flex-col items-center justify-center px-6 py-16 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5">
            <Filter className="text-slate-500" size={20} />
          </div>
          <p className="text-sm font-medium text-slate-300">
            {taskIndex.length === 0 ? '还没有生成任务' : '没有匹配的任务'}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {taskIndex.length === 0
              ? '在上方输入提示词，点击生成开始你的第一张图'
              : '尝试调整搜索词或筛选条件'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {filtered.map((t) => (
            <TaskCard key={t.id} taskId={t.id} onClick={() => onSelect?.(t.id)} />
          ))}
        </div>
      )}
    </div>
  )
}

export default TaskGallery
