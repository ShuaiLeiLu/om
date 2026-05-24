'use client'

import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import DataTable from '../DataTable'
import Badge from '../Badge'
import FilterBar, { FilterSelect } from '../FilterBar'
import Pagination from '../Pagination'
import { cn } from '@/lib/utils'
import { formatRelativeTime, formatTokens, quotaLedgerBadge } from '@/lib/admin-format'

const TYPE_OPTIONS = [
  { value: 'redeem_code', label: '兑换码' },
  { value: 'ad_reward', label: '广告奖励' },
  { value: 'recharge', label: '充值' },
  { value: 'manual_adjustment', label: '手动调整' },
  { value: 'model_usage', label: '模型消耗' },
  { value: 'grant_expired', label: '过期' },
  { value: 'refund', label: '退还' }
]

export default function LedgerTab({ data, filters, setFilter }) {
  const ledger = data.ledger || []
  const f = filters.ledger || {}

  return (
    <div className="space-y-4">
      <FilterBar>
        <FilterSelect
          value={f.type}
          onChange={(v) => setFilter('ledger', { type: v, page: 1 })}
          label="全部类型"
          options={TYPE_OPTIONS}
        />
      </FilterBar>

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle className="text-base">额度流水</CardTitle>
          <CardDescription>{ledger.length} 条</CardDescription>
        </CardHeader>
        <DataTable
          columns={[
            {
              key: 'type',
              label: '类型 / 备注',
              render: (r) => {
                const b = quotaLedgerBadge(r.type)
                return (
                  <div className="min-w-0">
                    <Badge tone={b.tone}>{b.label}</Badge>
                    <p className="mt-1 truncate text-[11px] text-muted-foreground">
                      {r.remark || r.relatedId || r.id}
                    </p>
                  </div>
                )
              }
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
              key: 'delta',
              label: '算力点',
              align: 'right',
              width: 120,
              render: (r) => {
                const n = Number(r.deltaTokens || 0)
                return (
                  <span
                    className={cn(
                      'font-mono font-semibold',
                      n >= 0 ? 'text-celadon-700' : 'text-verm-600'
                    )}
                  >
                    {n >= 0 ? '+' : ''}
                    {formatTokens(r.deltaTokens)}
                  </span>
                )
              }
            },
            {
              key: 'balance',
              label: '余额',
              align: 'right',
              width: 120,
              render: (r) => (
                <span className="font-mono text-[11px] text-ink-500">
                  {formatTokens(r.balanceAfter)}
                </span>
              )
            },
            {
              key: 'time',
              label: '时间',
              align: 'right',
              width: 110,
              render: (r) => (
                <span className="text-[11px] text-ink-500">
                  {formatRelativeTime(r.createdAt)}
                </span>
              )
            }
          ]}
          rows={ledger}
          rowKey={(r) => r.id}
        />
        <div className="px-4 pb-3 md:px-5">
          <Pagination
            page={f.page || 1}
            pageSize={40}
            count={ledger.length}
            onChange={(p) => setFilter('ledger', { page: p })}
          />
        </div>
      </Card>
    </div>
  )
}
