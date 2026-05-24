'use client'

import { CheckCircle2, Loader2 } from 'lucide-react'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import DataTable from '../DataTable'
import Badge from '../Badge'
import { formatRelativeTime, formatTokens, shortId } from '@/lib/admin-format'
import { markAdminRechargeOrderPaid } from '@/lib/api'

const STATUS = {
  pending: { tone: 'amber', label: '待支付' },
  paid: { tone: 'emerald', label: '已支付' },
  cancelled: { tone: 'slate', label: '已取消' },
  expired: { tone: 'rose', label: '已过期' }
}

const PAY_METHOD = {
  wechat: '微信',
  alipay: '支付宝',
  apple: 'Apple Pay'
}

export default function RechargeTab({ data, saving, runAction }) {
  const orders = data.rechargeOrders || []

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle className="text-base">充值订单</CardTitle>
        <CardDescription>创建支付订单后，可在接入真实支付回调前由管理员确认到账</CardDescription>
      </CardHeader>
      <DataTable
        columns={[
          {
            key: 'order',
            label: '订单',
            render: (order) => (
              <div className="min-w-0">
                <p className="truncate font-mono text-xs font-semibold text-ink-900">{order.orderNo}</p>
                <p className="mt-0.5 truncate text-[10px] text-ink-500">{shortId(order.id)}</p>
              </div>
            )
          },
          {
            key: 'user',
            label: '用户',
            render: (order) => (
              <div className="min-w-0">
                <p className="truncate font-semibold text-ink-900">{order.user?.displayName || '用户'}</p>
                <p className="mt-0.5 truncate text-[10px] text-ink-500">{order.user?.email || order.userId}</p>
              </div>
            )
          },
          {
            key: 'status',
            label: '状态',
            width: 82,
            render: (order) => {
              const badge = STATUS[order.status] || STATUS.pending
              return <Badge tone={badge.tone}>{badge.label}</Badge>
            }
          },
          {
            key: 'tokens',
            label: '额度',
            align: 'right',
            width: 100,
            render: (order) => <span className="font-mono text-celadon-700">{formatTokens(order.tokens)}</span>
          },
          {
            key: 'amount',
            label: '金额',
            align: 'right',
            width: 88,
            render: (order) => <span className="font-mono">¥ {(Number(order.amountCents || 0) / 100).toFixed(0)}</span>
          },
          {
            key: 'method',
            label: '渠道',
            width: 82,
            render: (order) => PAY_METHOD[order.paymentMethod] || order.paymentMethod
          },
          {
            key: 'createdAt',
            label: '创建',
            align: 'right',
            width: 110,
            render: (order) => <span className="text-[11px] text-ink-500">{formatRelativeTime(order.createdAt)}</span>
          },
          {
            key: 'action',
            label: '操作',
            align: 'right',
            width: 120,
            render: (order) => (
              <Button
                size="sm"
                variant={order.status === 'pending' ? 'gradient' : 'outline'}
                disabled={order.status !== 'pending' || saving === `recharge-${order.id}`}
                onClick={() =>
                  runAction(
                    `recharge-${order.id}`,
                    () => markAdminRechargeOrderPaid(order.id),
                    '充值订单已确认'
                  )
                }
              >
                {saving === `recharge-${order.id}` ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
                确认
              </Button>
            )
          }
        ]}
        rows={orders}
        rowKey={(order) => order.id}
      />
    </Card>
  )
}
