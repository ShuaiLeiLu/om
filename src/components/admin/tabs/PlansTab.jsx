'use client'

import { useState } from 'react'
import { Gift, Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import DataTable from '../DataTable'
import Badge from '../Badge'
import { formatRelativeTime, formatTokens } from '@/lib/admin-format'
import { createAdminPlan } from '@/lib/api'

export default function PlansTab({ data, saving, runAction }) {
  const plans = data.plans || []
  const [form, setForm] = useState({
    name: '',
    tokenAmount: '100',
    validDays: '30',
    remark: ''
  })

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">创建套餐</CardTitle>
          <CardDescription>套餐用于生成兑换码，按算力点数量 + 有效期发放</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={async (e) => {
              e.preventDefault()
              await runAction(
                'plan',
                () =>
                  createAdminPlan({
                    name: form.name,
                    tokenAmount: form.tokenAmount,
                    validDays: Number(form.validDays || 30),
                    remark: form.remark
                  }),
                '套餐已创建'
              )
              setForm({ name: '', tokenAmount: '100', validDays: '30', remark: '' })
            }}
            className="grid gap-3 lg:grid-cols-[1.4fr_1fr_0.8fr_1.6fr_auto] lg:items-end"
          >
            <Field label="套餐名">
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="月度体验包"
                required
              />
            </Field>
            <Field label="算力点数量">
              <Input
                value={form.tokenAmount}
                onChange={(e) => setForm({ ...form, tokenAmount: e.target.value })}
                className="font-mono"
                required
              />
            </Field>
            <Field label="有效天数">
              <Input
                type="number"
                min="1"
                value={form.validDays}
                onChange={(e) => setForm({ ...form, validDays: e.target.value })}
                className="font-mono"
              />
            </Field>
            <Field label="备注">
              <Input value={form.remark} onChange={(e) => setForm({ ...form, remark: e.target.value })} />
            </Field>
            <Button type="submit" variant="gradient" disabled={saving === 'plan'}>
              {saving === 'plan' ? <Loader2 className="animate-spin" /> : <Gift />}
              创建
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle className="text-base">套餐列表</CardTitle>
          <CardDescription>{plans.length} 个</CardDescription>
        </CardHeader>
        <DataTable
          columns={[
            {
              key: 'name',
              label: '名称',
              render: (p) => (
                <div className="min-w-0">
                  <p className="truncate font-semibold text-foreground">{p.name}</p>
                  <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
                    {p.remark || p.id}
                  </p>
                </div>
              )
            },
            {
              key: 'status',
              label: '状态',
              width: 80,
              render: (p) => (
                <Badge tone={p.status === 'active' ? 'emerald' : 'slate'}>
                  {p.status === 'active' ? '启用' : '停用'}
                </Badge>
              )
            },
            {
              key: 'tokens',
              label: '算力点',
              align: 'right',
              width: 120,
              render: (p) => (
                <span className="font-mono font-semibold text-primary">
                  {formatTokens(p.tokenAmount)}
                </span>
              )
            },
            {
              key: 'days',
              label: '有效',
              align: 'right',
              width: 80,
              render: (p) => <span className="text-foreground/80">{p.validDays} 天</span>
            },
            {
              key: 'createdAt',
              label: '创建',
              align: 'right',
              width: 110,
              render: (p) => (
                <span className="text-[11px] text-muted-foreground">
                  {formatRelativeTime(p.createdAt)}
                </span>
              )
            }
          ]}
          rows={plans}
          rowKey={(p) => p.id}
        />
      </Card>
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
