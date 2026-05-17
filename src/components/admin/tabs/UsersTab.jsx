'use client'

import { useMemo, useState } from 'react'
import { Ban, BadgeCheck, Coins, Loader2, Trash2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
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
import FilterBar, { FilterSelect } from '../FilterBar'
import Pagination from '../Pagination'
import { formatRelativeTime, maskOpenid, userStatusBadge } from '@/lib/admin-format'
import { adjustAdminQuota, deleteAdminUser, updateAdminUserStatus } from '@/lib/api'
import { cn } from '@/lib/utils'

export default function UsersTab({ data, filters, setFilter, saving, runAction }) {
  const users = data.users || []
  const f = filters.users || {}
  const [quotaForm, setQuotaForm] = useState({
    userId: '',
    tokens: '1000',
    validDays: '30',
    remark: '后台手动调整'
  })
  const [pendingToggle, setPendingToggle] = useState(null)
  const [pendingDelete, setPendingDelete] = useState(null)

  return (
    <div className="space-y-4">
      <FilterBar
        search={f.q}
        onSearchChange={(v) => setFilter('users', { q: v, page: 1 })}
        searchPlaceholder="昵称、openid、邮箱"
      >
        <FilterSelect
          value={f.status}
          onChange={(v) => setFilter('users', { status: v, page: 1 })}
          label="全部状态"
          options={[
            { value: 'active', label: '正常' },
            { value: 'disabled', label: '已禁用' }
          ]}
        />
      </FilterBar>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">手动调整 Token</CardTitle>
          <CardDescription>为单个用户增减额度，负数表示扣减</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={async (e) => {
              e.preventDefault()
              if (!quotaForm.userId || !quotaForm.tokens) return
              await runAction(
                'quota',
                () =>
                  adjustAdminQuota(quotaForm.userId, {
                    tokens: quotaForm.tokens,
                    validDays: Number(quotaForm.validDays || 30),
                    remark: quotaForm.remark
                  }),
                '额度已调整'
              )
            }}
            className="grid gap-3 lg:grid-cols-[1.6fr_1fr_0.8fr_1.4fr_auto] lg:items-end"
          >
            <FieldGroup label="选择用户">
              <Select
                value={quotaForm.userId}
                onValueChange={(v) => setQuotaForm((p) => ({ ...p, userId: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择用户" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      <div className="flex min-w-0 flex-col text-left">
                        <span className="truncate">{u.displayName || '微信用户'}</span>
                        <span className="truncate text-[10px] text-muted-foreground">
                          {u.email || u.id}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldGroup>
            <FieldGroup label="Token 增减">
              <Input
                value={quotaForm.tokens}
                onChange={(e) => setQuotaForm((p) => ({ ...p, tokens: e.target.value }))}
                placeholder="-1000 或 1000"
                className="font-mono"
              />
            </FieldGroup>
            <FieldGroup label="有效天数">
              <Input
                type="number"
                min="1"
                value={quotaForm.validDays}
                onChange={(e) => setQuotaForm((p) => ({ ...p, validDays: e.target.value }))}
                className="font-mono"
              />
            </FieldGroup>
            <FieldGroup label="备注">
              <Input
                value={quotaForm.remark}
                onChange={(e) => setQuotaForm((p) => ({ ...p, remark: e.target.value }))}
                placeholder="补充说明"
              />
            </FieldGroup>
            <Button
              type="submit"
              variant="gradient"
              disabled={saving === 'quota' || !quotaForm.userId}
              className="h-9"
            >
              {saving === 'quota' ? (
                <Loader2 className="animate-spin" />
              ) : (
                <Coins />
              )}
              调整
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle className="text-base">用户列表</CardTitle>
          <CardDescription>{users.length} 条</CardDescription>
        </CardHeader>
        <DataTable
          columns={[
            {
              key: 'user',
              label: '用户',
              render: (u) => {
                const b = userStatusBadge(u.status)
                return (
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-semibold text-foreground">
                        {u.displayName || '微信用户'}
                      </p>
                      <Badge tone={b.tone}>{b.label}</Badge>
                    </div>
                    <p className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground">
                      {u.id}
                    </p>
                  </div>
                )
              }
            },
            {
              key: 'wechat',
              label: '微信 / 邮箱',
              width: 220,
              render: (u) => (
                <div className="min-w-0 text-[11px] text-muted-foreground">
                  <p className="truncate">
                    {u.email || maskOpenid(u.oauthAccounts?.[0]?.openid) || '未绑定'}
                  </p>
                  <p className="mt-0.5">OAuth {u.oauthAccounts?.length || 0} 个</p>
                </div>
              )
            },
            {
              key: 'time',
              label: '注册 / 最近登录',
              width: 180,
              render: (u) => (
                <div className="text-[11px] text-muted-foreground">
                  <p>注册 {formatRelativeTime(u.createdAt)}</p>
                  <p className="mt-0.5">
                    登录 {u.lastLoginAt ? formatRelativeTime(u.lastLoginAt) : '-'}
                  </p>
                </div>
              )
            },
            {
              key: 'actions',
              label: '操作',
              align: 'right',
              width: 200,
              render: (u) => (
                <div className="flex justify-end gap-1.5">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    title="填到调整额度"
                    onClick={() => setQuotaForm((p) => ({ ...p, userId: u.id }))}
                  >
                    <Coins />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                      'h-8',
                      u.status === 'active'
                        ? 'border-destructive/30 text-destructive hover:bg-destructive/10'
                        : 'border-emerald-400/30 text-emerald-300 hover:bg-emerald-500/10'
                    )}
                    onClick={() =>
                      setPendingToggle({ id: u.id, status: u.status, name: u.displayName })
                    }
                    disabled={saving === `user-${u.id}`}
                  >
                    {saving === `user-${u.id}` ? (
                      <Loader2 className="animate-spin" />
                    ) : u.status === 'active' ? (
                      <Ban />
                    ) : (
                      <BadgeCheck />
                    )}
                    {u.status === 'active' ? '禁用' : '启用'}
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 border-destructive/30 text-destructive hover:bg-destructive/10"
                    title="删除用户"
                    onClick={() => setPendingDelete({ id: u.id, name: u.displayName || u.email || u.id })}
                    disabled={saving === `delete-user-${u.id}`}
                  >
                    {saving === `delete-user-${u.id}` ? (
                      <Loader2 className="animate-spin" />
                    ) : (
                      <Trash2 />
                    )}
                  </Button>
                </div>
              )
            }
          ]}
          rows={users}
          rowKey={(u) => u.id}
        />
        <div className="px-4 pb-3 md:px-5">
          <Pagination
            page={f.page || 1}
            pageSize={20}
            count={users.length}
            onChange={(p) => setFilter('users', { page: p })}
          />
        </div>
      </Card>

      <AlertDialog
        open={!!pendingToggle}
        onOpenChange={(v) => !v && setPendingToggle(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingToggle?.status === 'active' ? '禁用该用户？' : '启用该用户？'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingToggle?.status === 'active'
                ? `禁用后会撤销该用户的所有会话，无法登录。用户：${pendingToggle?.name || pendingToggle?.id}`
                : `用户：${pendingToggle?.name || pendingToggle?.id}`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className={cn(
                pendingToggle?.status === 'active' &&
                  'bg-destructive text-destructive-foreground hover:bg-destructive/90'
              )}
              onClick={async () => {
                const target = pendingToggle
                setPendingToggle(null)
                await runAction(
                  `user-${target.id}`,
                  () =>
                    updateAdminUserStatus(
                      target.id,
                      target.status === 'active' ? 'disabled' : 'active'
                    ),
                  target.status === 'active' ? '用户已禁用' : '用户已启用'
                )
              }}
            >
              {pendingToggle?.status === 'active' ? '确认禁用' : '确认启用'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!pendingDelete}
        onOpenChange={(v) => !v && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除该用户？</AlertDialogTitle>
            <AlertDialogDescription>
              {`将永久删除用户 ${pendingDelete?.name || pendingDelete?.id} 及其会话、Token 账本、对话、请求记录、图片任务等关联数据。这个操作不可恢复。`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                const target = pendingDelete
                setPendingDelete(null)
                await runAction(
                  `delete-user-${target.id}`,
                  () => deleteAdminUser(target.id),
                  '用户已删除'
                )
              }}
            >
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function FieldGroup({ label, children }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  )
}
