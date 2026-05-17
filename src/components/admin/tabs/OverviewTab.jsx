'use client'

import {
  Activity,
  BadgeCheck,
  Boxes,
  Coins,
  DatabaseZap,
  Gift,
  Loader2,
  MessageSquareText,
  UsersRound
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import AdminStatCard from '../AdminStatCard'
import DataTable from '../DataTable'
import Badge from '../Badge'
import {
  formatBytes,
  formatNumber,
  formatTokens,
  formatRelativeTime,
  llmRequestBadge,
  quotaLedgerBadge
} from '@/lib/admin-format'
import { syncAdminSub2api } from '@/lib/api'

export default function OverviewTab({ data, runAction, saving }) {
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
          label="Token 净变动"
          value={formatTokens(dashboard?.totalTokenDelta)}
          hint={`模型消耗 ${formatTokens(dashboard?.modelUsageTokens)}`}
          loading={loading}
        />
        <AdminStatCard
          icon={Gift}
          tone="emerald"
          label="广告奖励 Token"
          value={formatTokens(dashboard?.adRewardTokens)}
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

      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-6">
          <div>
            <p className="text-sm font-semibold text-foreground">Sub2API 用量同步</p>
            <p className="mt-1 text-xs text-muted-foreground">手动拉取上游 usage 并据此扣减 Token</p>
          </div>
          <Button
            variant="gradient"
            onClick={() => runAction('sync', syncAdminSub2api, 'Sub2API 用量同步已触发')}
            disabled={saving === 'sync'}
          >
            {saving === 'sync' ? <Loader2 className="animate-spin" /> : <DatabaseZap />}
            立即同步
          </Button>
        </CardContent>
      </Card>

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
                  const b = quotaLedgerBadge(r.type)
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
                label: 'Token',
                align: 'right',
                width: 110,
                render: (r) => {
                  const n = Number(r.deltaTokens || 0)
                  return (
                    <span
                      className={
                        n >= 0
                          ? 'font-mono font-semibold text-emerald-300'
                          : 'font-mono font-semibold text-rose-300'
                      }
                    >
                      {n >= 0 ? '+' : ''}
                      {formatTokens(r.deltaTokens)}
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
