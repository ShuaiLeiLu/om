'use client'

import { Loader2, Save } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import DataTable from '../DataTable'
import Badge from '../Badge'
import { formatRelativeTime, formatTokens } from '@/lib/admin-format'
import { updateAdminRewardConfig } from '@/lib/api'

export default function RewardsTab({ data, setRewardConfig, saving, runAction }) {
  const rewardConfig = data.rewardConfig
  const rewardEvents = data.rewardEvents || []
  const usageEvents = data.usageEvents || []

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">广告奖励配置</CardTitle>
          <CardDescription>控制小程序看广告领 Token 的活动</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              runAction(
                'reward-config',
                () =>
                  updateAdminRewardConfig({
                    enabled: Boolean(rewardConfig?.enabled),
                    adUnitId: rewardConfig?.adUnitId || '',
                    rewardTokens: rewardConfig?.rewardTokens || 0,
                    dailyLimitPerUser: Number(rewardConfig?.dailyLimitPerUser || 0),
                    rewardTokenValidDays: Number(rewardConfig?.rewardTokenValidDays || 1),
                    minIntervalSeconds: Number(rewardConfig?.minIntervalSeconds || 0),
                    sessionTtlSeconds: Number(rewardConfig?.sessionTtlSeconds || 300)
                  }),
                '广告配置已保存'
              )
            }}
            className="space-y-3"
          >
            <div className="flex items-center justify-between rounded-xl border bg-card/30 px-4 py-3">
              <Label htmlFor="reward-enabled" className="text-sm">
                启用广告奖励
              </Label>
              <Switch
                id="reward-enabled"
                checked={Boolean(rewardConfig?.enabled)}
                onCheckedChange={(checked) =>
                  setRewardConfig({ ...(rewardConfig || {}), enabled: checked })
                }
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="广告位 ID">
                <Input
                  value={rewardConfig?.adUnitId || ''}
                  onChange={(e) =>
                    setRewardConfig({ ...(rewardConfig || {}), adUnitId: e.target.value })
                  }
                  className="font-mono"
                />
              </Field>
              <Field label="单次奖励 Token">
                <Input
                  value={rewardConfig?.rewardTokens || ''}
                  onChange={(e) =>
                    setRewardConfig({ ...(rewardConfig || {}), rewardTokens: e.target.value })
                  }
                  className="font-mono"
                />
              </Field>
              <Field label="每日上限">
                <Input
                  type="number"
                  min="0"
                  value={rewardConfig?.dailyLimitPerUser || ''}
                  onChange={(e) =>
                    setRewardConfig({
                      ...(rewardConfig || {}),
                      dailyLimitPerUser: e.target.value
                    })
                  }
                  className="font-mono"
                />
              </Field>
              <Field label="奖励有效天数">
                <Input
                  type="number"
                  min="1"
                  value={rewardConfig?.rewardTokenValidDays || ''}
                  onChange={(e) =>
                    setRewardConfig({
                      ...(rewardConfig || {}),
                      rewardTokenValidDays: e.target.value
                    })
                  }
                  className="font-mono"
                />
              </Field>
              <Field label="最小间隔秒">
                <Input
                  type="number"
                  min="0"
                  value={rewardConfig?.minIntervalSeconds || ''}
                  onChange={(e) =>
                    setRewardConfig({
                      ...(rewardConfig || {}),
                      minIntervalSeconds: e.target.value
                    })
                  }
                  className="font-mono"
                />
              </Field>
              <Field label="会话 TTL 秒">
                <Input
                  type="number"
                  min="30"
                  value={rewardConfig?.sessionTtlSeconds || ''}
                  onChange={(e) =>
                    setRewardConfig({
                      ...(rewardConfig || {}),
                      sessionTtlSeconds: e.target.value
                    })
                  }
                  className="font-mono"
                />
              </Field>
            </div>
            <div className="pt-1">
              <Button type="submit" variant="gradient" disabled={saving === 'reward-config'}>
                {saving === 'reward-config' ? <Loader2 className="animate-spin" /> : <Save />}
                保存配置
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle className="text-base">广告奖励事件</CardTitle>
            <CardDescription>{rewardEvents.length} 条</CardDescription>
          </CardHeader>
          <DataTable
            dense
            columns={[
              {
                key: 'event',
                label: '事件 / 主体',
                render: (e) => (
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-foreground">{e.eventType}</p>
                    <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
                      {e.openid || e.userId || e.rewardSessionId || '系统'}
                    </p>
                  </div>
                )
              },
              {
                key: 'result',
                label: '结果',
                width: 90,
                render: (e) => (
                  <Badge
                    tone={
                      e.result === 'granted'
                        ? 'emerald'
                        : e.result === 'rejected'
                          ? 'rose'
                          : 'slate'
                    }
                  >
                    {e.result}
                  </Badge>
                )
              },
              {
                key: 'time',
                label: '时间',
                align: 'right',
                width: 100,
                render: (e) => (
                  <span className="text-[11px] text-muted-foreground">
                    {formatRelativeTime(e.createdAt)}
                  </span>
                )
              }
            ]}
            rows={rewardEvents.slice(0, 80)}
            rowKey={(e) => e.id}
          />
        </Card>

        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle className="text-base">Sub2API Usage</CardTitle>
            <CardDescription>{usageEvents.length} 条</CardDescription>
          </CardHeader>
          <DataTable
            dense
            columns={[
              {
                key: 'model',
                label: '模型',
                render: (e) => (
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-foreground">
                      {e.modelId || 'unknown model'}
                    </p>
                    <p className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground">
                      {e.sub2apiUsageId}
                    </p>
                  </div>
                )
              },
              {
                key: 'status',
                label: '状态',
                width: 90,
                render: (e) => (
                  <Badge tone={e.status === 'matched' ? 'emerald' : 'slate'}>
                    {e.status}
                  </Badge>
                )
              },
              {
                key: 'tokens',
                label: 'Token',
                align: 'right',
                width: 100,
                render: (e) => (
                  <span className="font-mono font-semibold text-primary">
                    {formatTokens(e.totalTokens)}
                  </span>
                )
              }
            ]}
            rows={usageEvents.slice(0, 80)}
            rowKey={(e) => e.id}
          />
        </Card>
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  )
}
