'use client'

import {
  Activity,
  BadgeCheck,
  Boxes,
  Coins,
  DatabaseZap,
  Gift,
  MessageSquareText,
  UsersRound
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import AdminStatCard from '../AdminStatCard'
import DataTable from '../DataTable'
import Badge from '../Badge'
import {
  formatBytes,
  formatNumber,
  formatPoints,
  formatRelativeTime,
  llmRequestBadge,
  pointLedgerBadge
} from '@/lib/admin-format'

export default function OverviewTab({ data }) {
  const dashboard = data.dashboard
  const todayGranted = (data.rewardEvents || []).filter(
    (e) => e.result === 'granted' && isToday(e.createdAt)
  ).length
  const loading = !dashboard

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <AdminStatCard
          icon={UsersRound}
          tone="indigo"
          label="用户总数"
          value={formatNumber(dashboard?.users)}
          hint={`活跃 ${formatNumber(dashboard?.activeUsers)} · 7 日新增 ${formatNumber(dashboard?.newUsers7d)}`}
          loading={loading}
        />
        <AdminStatCard
          icon={MessageSquareText}
          tone="fuchsia"
          label="模型请求"
          value={formatNumber(dashboard?.llmRequests)}
          hint={`7 日 ${formatNumber(dashboard?.requests7d)} · 失败 ${formatNumber(dashboard?.failedRequests)}`}
          loading={loading}
        />
        <AdminStatCard
          icon={Boxes}
          tone="sky"
          label="图片任务"
          value={formatNumber(dashboard?.imageTasks)}
          hint={`7 日新增 ${formatNumber(dashboard?.imageTasks7d)}`}
          loading={loading}
        />
        <AdminStatCard
          icon={Coins}
          tone="amber"
          label="算力点 净变动"
          value={formatPoints(dashboard?.totalPointDelta)}
          hint={`模型消耗 ${formatPoints(dashboard?.modelUsagePoints)}`}
          loading={loading}
        />
        <AdminStatCard
          icon={Gift}
          tone="emerald"
          label="广告奖励 算力点"
          value={formatPoints(dashboard?.adRewardPoints)}
          hint={`今日发放 ${todayGranted} 次`}
          loading={loading}
        />
        <AdminStatCard
          icon={Activity}
          tone="violet"
          label="活跃会话"
          value={formatNumber(dashboard?.conversations)}
          hint="未删除对话数"
          loading={loading}
        />
        <AdminStatCard
          icon={DatabaseZap}
          tone="rose"
          label="存储图片"
          value={formatNumber(dashboard?.storedImages)}
          hint={formatBytes(dashboard?.storageBytes)}
          loading={loading}
        />
        <AdminStatCard
          icon={BadgeCheck}
          tone="emerald"
          label="完成请求"
          value={formatNumber(dashboard?.completedRequests)}
          hint="模型网关完成量"
          loading={loading}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle className="text-base">最近请求</CardTitle>
            <CardDescription>{data.requests.length} 条</CardDescription>
          </CardHeader>
          <DataTable
            dense
            columns={[
              {
                key: 'model',
                label: '模型 / 用户',
                render: (r) => (
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-foreground">{r.modelId}</p>
                    <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
                      {r.user?.displayName || r.userId || '-'}
                    </p>
                  </div>
                )
              },
              {
                key: 'status',
                label: '状态',
                width: 90,
                render: (r) => {
                  const b = llmRequestBadge(r.status)
                  return <Badge tone={b.tone}>{b.label}</Badge>
                }
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
            rows={(data.requests || []).slice(0, 8)}
            rowKey={(r) => r.id}
          />
        </Card>

        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle className="text-base">最近额度流水</CardTitle>
            <CardDescription>今日发放 {todayGranted} 次广告奖励</CardDescription>
          </CardHeader>
          <DataTable
            dense
            columns={[
              {
                key: 'type',
                label: '类型 / 备注',
                render: (r) => {
                  const b = pointLedgerBadge(r.type)
                  return (
                    <div className="min-w-0">
                      <Badge tone={b.tone}>{b.label}</Badge>
                      <p className="mt-1 truncate text-[10px] text-muted-foreground">
                        {r.remark || r.user?.displayName || r.userId || '-'}
                      </p>
                    </div>
                  )
                }
              },
              {
                key: 'delta',
                label: '算力点',
                align: 'right',
                width: 110,
                render: (r) => {
                  const n = Number(r.deltaPoints || 0)
                  return (
                    <span
                      className={
                        n >= 0
                          ? 'font-mono font-semibold text-emerald-300'
                          : 'font-mono font-semibold text-rose-300'
                      }
                    >
                      {n >= 0 ? '+' : ''}
                      {formatPoints(r.deltaPoints)}
                    </span>
                  )
                }
              }
            ]}
            rows={(data.ledger || []).slice(0, 8)}
            rowKey={(r) => r.id}
          />
        </Card>
      </div>
    </div>
  )
}

function isToday(value) {
  if (!value) return false
  const d = new Date(value)
  const n = new Date()
  return (
    d.getFullYear() === n.getFullYear() &&
    d.getMonth() === n.getMonth() &&
    d.getDate() === n.getDate()
  )
}
