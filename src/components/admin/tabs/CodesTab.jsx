'use client'

import { useState } from 'react'
import { Ban, Copy, KeyRound, Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
import { formatRelativeTime, formatTokens } from '@/lib/admin-format'
import { createAdminRedeemCodes, revokeAdminRedeemCode } from '@/lib/api'

const STATUS_TONE = {
  unused: 'emerald',
  used: 'slate',
  revoked: 'rose',
  expired: 'amber'
}
const STATUS_LABEL = {
  unused: '未使用',
  used: '已使用',
  revoked: '已撤销',
  expired: '已过期'
}

export default function CodesTab({ data, saving, setError, refresh }) {
  const plans = data.plans || []
  const codes = data.codes || []
  const [form, setForm] = useState({ planId: '', count: '10', expiresAt: '' })
  const [generated, setGenerated] = useState([])
  const [pendingRevoke, setPendingRevoke] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">生成兑换码</CardTitle>
          <CardDescription>批量生成属于某个套餐的兑换码</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={async (e) => {
              e.preventDefault()
              setSubmitting(true)
              setError('')
              try {
                const result = await createAdminRedeemCodes({
                  planId: form.planId,
                  count: Number(form.count || 1),
                  expiresAt: form.expiresAt || undefined
                })
                setGenerated(Array.isArray(result?.codes) ? result.codes : [])
                await refresh('codes')
              } catch (err) {
                setError(err.message || '兑换码生成失败')
              } finally {
                setSubmitting(false)
              }
            }}
            className="grid gap-3 lg:grid-cols-[2fr_0.8fr_1.4fr_auto] lg:items-end"
          >
            <Field label="选择套餐">
              <Select value={form.planId} onValueChange={(v) => setForm({ ...form, planId: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="选择套餐" />
                </SelectTrigger>
                <SelectContent>
                  {plans.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      <div className="flex min-w-0 flex-col text-left">
                        <span className="truncate">{p.name}</span>
                        <span className="truncate text-[10px] text-muted-foreground">
                          {formatTokens(p.tokenAmount)} 算力点 / {p.validDays} 天
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="数量">
              <Input
                type="number"
                min="1"
                max="1000"
                value={form.count}
                onChange={(e) => setForm({ ...form, count: e.target.value })}
                className="font-mono"
              />
            </Field>
            <Field label="过期时间（可选）">
              <Input
                type="datetime-local"
                value={form.expiresAt}
                onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
              />
            </Field>
            <Button type="submit" variant="gradient" disabled={submitting || !form.planId}>
              {submitting ? <Loader2 className="animate-spin" /> : <KeyRound />}
              生成
            </Button>
          </form>
        </CardContent>
      </Card>

      {generated.length > 0 && (
        <Card className="border-gold-500/30 bg-gold-500/10">
          <CardContent className="pt-6">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground">本次生成的明文兑换码</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  关闭页面后无法再次查看，请妥善保存
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigator.clipboard?.writeText(generated.join('\n'))}
              >
                <Copy /> 复制全部
              </Button>
            </div>
            <Textarea
              readOnly
              value={generated.join('\n')}
              rows={6}
              className="font-mono text-celadon-700"
            />
          </CardContent>
        </Card>
      )}

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle className="text-base">兑换码记录</CardTitle>
          <CardDescription>{codes.length} 条</CardDescription>
        </CardHeader>
        <DataTable
          columns={[
            {
              key: 'plan',
              label: '套餐',
              render: (c) => (
                <div className="min-w-0">
                  <p className="truncate font-semibold text-foreground">
                    {c.plan?.name || '未知套餐'}
                  </p>
                  <p className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground">
                    {c.id}
                  </p>
                </div>
              )
            },
            {
              key: 'status',
              label: '状态',
              width: 80,
              render: (c) => (
                <Badge tone={STATUS_TONE[c.status] || 'slate'}>
                  {STATUS_LABEL[c.status] || c.status}
                </Badge>
              )
            },
            {
              key: 'expiresAt',
              label: '过期',
              width: 130,
              align: 'right',
              render: (c) => (
                <span className="text-[11px] text-muted-foreground">
                  {c.expiresAt ? formatRelativeTime(c.expiresAt) : '长期'}
                </span>
              )
            },
            {
              key: 'actions',
              label: '操作',
              align: 'right',
              width: 100,
              render: (c) => (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 border-destructive/30 text-destructive hover:bg-destructive/10 disabled:opacity-30"
                  onClick={() => setPendingRevoke(c)}
                  disabled={c.status !== 'unused' || saving === `code-${c.id}`}
                >
                  {saving === `code-${c.id}` ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <Ban />
                  )}
                  撤销
                </Button>
              )
            }
          ]}
          rows={codes}
          rowKey={(c) => c.id}
        />
      </Card>

      <AlertDialog open={!!pendingRevoke} onOpenChange={(v) => !v && setPendingRevoke(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>撤销兑换码？</AlertDialogTitle>
            <AlertDialogDescription>
              兑换码 {pendingRevoke?.id} 一旦撤销不可恢复
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                const target = pendingRevoke
                setPendingRevoke(null)
                try {
                  setError('')
                  await revokeAdminRedeemCode(target.id)
                  await refresh('codes')
                } catch (err) {
                  setError(err.message || '撤销失败')
                }
              }}
            >
              确认撤销
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
