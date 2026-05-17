'use client'

import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import DataTable from '../DataTable'
import Badge from '../Badge'
import FilterBar, { FilterSelect } from '../FilterBar'
import Pagination from '../Pagination'
import { formatRelativeTime, llmRequestBadge, shortId } from '@/lib/admin-format'

const STATUS_OPTIONS = [
  { value: 'pending', label: '排队中' },
  { value: 'streaming', label: '响应中' },
  { value: 'completed', label: '完成' },
  { value: 'failed', label: '失败' },
  { value: 'cancelled', label: '取消' }
]

export default function RequestsTab({ data, filters, setFilter }) {
  const requests = data.requests || []
  const f = filters.requests || {}

  return (
    <div className="space-y-4">
      <FilterBar>
        <FilterSelect
          value={f.status}
          onChange={(v) => setFilter('requests', { status: v, page: 1 })}
          label="全部状态"
          options={STATUS_OPTIONS}
        />
      </FilterBar>

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle className="text-base">模型请求记录</CardTitle>
          <CardDescription>{requests.length} 条</CardDescription>
        </CardHeader>
        <DataTable
          columns={[
            {
              key: 'model',
              label: '模型 / requestId',
              render: (r) => (
                <div className="min-w-0">
                  <p className="truncate font-semibold text-foreground">{r.modelId}</p>
                  <p className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground">
                    {shortId(r.requestId)}
                  </p>
                </div>
              )
            },
            {
              key: 'user',
              label: '用户',
              width: 180,
              render: (r) => (
                <span className="text-[11px] text-muted-foreground">
                  {r.user?.displayName || r.userId || '-'}
                </span>
              )
            },
            {
              key: 'status',
              label: '状态',
              width: 100,
              render: (r) => {
                const b = llmRequestBadge(r.status)
                return <Badge tone={b.tone}>{b.label}</Badge>
              }
            },
            {
              key: 'error',
              label: '上游 / 错误',
              render: (r) => (
                <span className="line-clamp-1 text-[11px] text-muted-foreground">
                  {r.errorMessage || r.sub2apiRequestId || '-'}
                </span>
              )
            },
            {
              key: 'time',
              label: '时间',
              align: 'right',
              width: 110,
              render: (r) => (
                <span className="text-[11px] text-muted-foreground">
                  {formatRelativeTime(r.createdAt)}
                </span>
              )
            }
          ]}
          rows={requests}
          rowKey={(r) => r.id}
        />
        <div className="px-4 pb-3 md:px-5">
          <Pagination
            page={f.page || 1}
            pageSize={40}
            count={requests.length}
            onChange={(p) => setFilter('requests', { page: p })}
          />
        </div>
      </Card>
    </div>
  )
}
