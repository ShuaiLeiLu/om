'use client'

import { ArrowLeft, Loader2, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import ModelCard from './ModelCard'

export function ModelPickerView({ provider, models, loading, onBack, onPick }) {
  const [query, setQuery] = useState('')
  const isDeepseek = provider?.id === 'deepseek'

  const filtered = useMemo(() => {
    if (!query.trim()) return models
    const q = query.toLowerCase()
    return models.filter(
      (m) =>
        (m.name || '').toLowerCase().includes(q) || (m.id || '').toLowerCase().includes(q)
    )
  }, [models, query])

  return (
    <div className="space-y-5">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 rounded-xl bg-rice-50 px-3 py-2 text-xs font-medium text-celadon-700 shadow-[var(--shadow-paper)] transition hover:bg-rice-100 min-h-[40px]"
      >
        <ArrowLeft size={13} /> 返回供应商
      </button>

      <div className="flex flex-col gap-4 rounded-2xl border border-ink-700/10 bg-rice-50 p-4 md:p-5 shadow-[var(--shadow-paper)] md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'flex h-12 w-12 md:h-14 md:w-14 shrink-0 items-center justify-center rounded-2xl border border-ink-700/10',
              isDeepseek ? 'bg-white' : ''
            )}
            style={!isDeepseek ? { backgroundColor: `${provider?.color}25` } : undefined}
          >
            {provider?.logo ? (
              <img src={provider.logo} alt="" className="h-7 w-7 md:h-8 md:w-8 object-contain" />
            ) : (
              <span
                className="text-xl md:text-2xl font-bold"
                style={{ color: provider?.color }}
              >
                {provider?.initial}
              </span>
            )}
          </div>
          <div className="min-w-0">
            <h2 className="font-serif text-lg md:text-xl font-semibold text-ink-900">{provider?.name}</h2>
            <p className="mt-0.5 text-xs text-ink-500 line-clamp-2">
              {provider?.description} · {models.length} 个模型
            </p>
          </div>
        </div>

        <div className="relative w-full md:w-72">
          <Search
            size={14}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-500"
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索模型..."
            inputMode="search"
            autoCorrect="off"
            autoCapitalize="off"
            className="h-11 w-full rounded-xl border border-ink-700/10 bg-rice-50 pl-9 pr-3 text-sm text-ink-900 outline-none transition focus:border-celadon-500/45 md:h-10"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          <div className="col-span-full py-14 text-center">
            <Loader2 className="mx-auto animate-spin text-celadon-600" size={26} />
            <p className="mt-3 text-xs text-ink-500">正在获取可用模型...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="col-span-full rounded-2xl border border-ink-700/10 bg-rice-50 px-5 py-12 text-center">
            <p className="text-sm font-medium text-ink-900">
              {models.length === 0 ? '暂无可用模型' : '没有匹配的模型'}
            </p>
            <p className="mt-2 text-xs text-ink-500">
              {models.length === 0 ? '请在后台启用模型后再开始对话' : '尝试调整搜索关键词'}
            </p>
          </div>
        ) : (
          filtered.map((m) => <ModelCard key={m.id} model={m} onClick={() => onPick(m)} />)
        )}
      </div>
    </div>
  )
}

export default ModelPickerView
