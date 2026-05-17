'use client'

import { useState } from 'react'
import { Ban, Loader2 } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog'
import DataTable from '../DataTable'
import Badge from '../Badge'
import FilterBar from '../FilterBar'
import Pagination from '../Pagination'
import { formatRelativeTime, maskOpenid } from '@/lib/admin-format'
import { unbindAdminWechatAccount } from '@/lib/api'

export default function WechatTab({ data, filters, setFilter, saving, runAction }) {
  const accounts = data.wechatAccounts || []
  const f = filters.wechat || {}
  const [pendingUnbind, setPendingUnbind] = useState(null)

  return (
    <div className="space-y-4">
      <FilterBar
        search={f.q}
        onSearchChange={(v) => setFilter('wechat', { q: v, page: 1 })}
        searchPlaceholder="openid / unionid / 昵称"
      />

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle className="text-base">微信小程序绑定</CardTitle>
          <CardDescription>{accounts.length} 条</CardDescription>
        </CardHeader>
        <DataTable
          columns={[
            {
              key: 'nickname',
              label: '昵称 / openid',
              render: (a) => (
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-semibold text-foreground">
                      {a.nickname || a.user?.displayName || '微信用户'}
                    </p>
                    {a.user?.email && <Badge tone="emerald">已绑邮箱</Badge>}
                  </div>
                  <p className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground">
                    {maskOpenid(a.openid)}
                  </p>
                </div>
              )
            },
            {
              key: 'union',
              label: 'unionid / 用户',
              width: 240,
              render: (a) => (
                <div className="min-w-0 text-[11px] text-muted-foreground">
                  <p className="truncate">{a.unionid ? maskOpenid(a.unionid) : '无 unionid'}</p>
                  <p className="mt-0.5 truncate font-mono">{a.user?.id || '-'}</p>
                </div>
              )
            },
            {
              key: 'time',
              label: '绑定时间',
              width: 110,
              align: 'right',
              render: (a) => (
                <span className="text-[11px] text-muted-foreground">
                  {formatRelativeTime(a.boundAt || a.createdAt)}
                </span>
              )
            },
            {
              key: 'actions',
              label: '操作',
              align: 'right',
              width: 100,
              render: (a) => (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 border-destructive/30 text-destructive hover:bg-destructive/10"
                  onClick={() => setPendingUnbind(a)}
                  disabled={saving === `wechat-${a.id}`}
                >
                  {saving === `wechat-${a.id}` ? <Loader2 className="animate-spin" /> : <Ban />}
                  解绑
                </Button>
              )
            }
          ]}
          rows={accounts}
          rowKey={(a) => a.id}
        />
        <div className="px-4 pb-3 md:px-5">
          <Pagination
            page={f.page || 1}
            pageSize={40}
            count={accounts.length}
            onChange={(p) => setFilter('wechat', { page: p })}
          />
        </div>
      </Card>

      <AlertDialog open={!!pendingUnbind} onOpenChange={(v) => !v && setPendingUnbind(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>解绑微信账号？</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingUnbind &&
                `openid: ${maskOpenid(pendingUnbind.openid)} — 该用户的小程序会话将被撤销，但 web 端登录不受影响。`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                const target = pendingUnbind
                setPendingUnbind(null)
                await runAction(
                  `wechat-${target.id}`,
                  () => unbindAdminWechatAccount(target.id),
                  '微信身份已解绑'
                )
              }}
            >
              确认解绑
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
