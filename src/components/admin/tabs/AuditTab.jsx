'use client'

import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import DataTable from '../DataTable'
import FilterBar from '../FilterBar'
import Pagination from '../Pagination'
import { formatRelativeTime, shortId } from '@/lib/admin-format'

export default function AuditTab({ data, filters, setFilter }) {
  const logs = data.auditLogs || []
  const f = filters.audit || {}

  return (
    <div className="space-y-4">
      <FilterBar
        search={f.action}
        onSearchChange={(v) => setFilter('audit', { action: v, page: 1 })}
        searchPlaceholder="按动作名筛选 e.g. points_adjust"
      />

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle className="text-base">管理员审计日志</CardTitle>
          <CardDescription>{logs.length} 条</CardDescription>
        </CardHeader>
        <DataTable
          columns={[
            {
              key: 'action',
              label: '动作 / 管理员',
              render: (l) => (
                <div className="min-w-0">
                  <p className="truncate font-semibold text-foreground">{l.action}</p>
                  <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
                    {l.adminUser?.username || 'system'} · {l.targetType}
                  </p>
                </div>
              )
            },
            {
              key: 'target',
              label: '目标',
              render: (l) => (
                <span className="font-mono text-[11px] text-muted-foreground">
                  {shortId(l.targetId, 12)}
                </span>
              )
            },
            {
              key: 'time',
              label: '时间',
              align: 'right',
              width: 110,
              render: (l) => (
                <span className="text-[11px] text-muted-foreground">
                  {formatRelativeTime(l.createdAt)}
                </span>
              )
            }
          ]}
          rows={logs}
          rowKey={(l) => l.id}
        />
        <div className="px-4 pb-3 md:px-5">
          <Pagination
            page={f.page || 1}
            pageSize={60}
            count={logs.length}
            onChange={(p) => setFilter('audit', { page: p })}
          />
        </div>
      </Card>
    </div>
  )
}
