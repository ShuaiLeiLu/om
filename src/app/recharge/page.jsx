'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, CreditCard, Loader2 } from 'lucide-react'
import { createRechargeOrder, fetchRechargeOrders, fetchRechargePlans } from '@/lib/api'
import ProfileShell from '@/components/profile/ProfileShell'
import { toast } from '@/components/ui/sonner'
import { useAuthStore } from '@/store/useStore'
import { cn } from '@/lib/utils'

export default function RechargePage() {
  const router = useRouter()
  const user = useAuthStore((s) => s.user)
  const [plans, setPlans] = useState([])
  const [orders, setOrders] = useState([])
  const [selectedPlanId, setSelectedPlanId] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('wechat')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const selectedPlan = useMemo(
    () => plans.find((plan) => plan.id === selectedPlanId) || plans[1] || plans[0],
    [plans, selectedPlanId]
  )

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        setLoading(true)
        const [nextPlans, nextOrders] = await Promise.all([
          fetchRechargePlans(),
          user ? fetchRechargeOrders().catch(() => []) : Promise.resolve([])
        ])
        if (cancelled) return
        setPlans(Array.isArray(nextPlans) ? nextPlans : [])
        setOrders(Array.isArray(nextOrders) ? nextOrders : [])
        setSelectedPlanId((current) => current || nextPlans?.[1]?.id || nextPlans?.[0]?.id || '')
      } catch (err) {
        if (!cancelled) toast.error('充值套餐加载失败', { description: err?.message || '请稍后重试' })
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [user])

  async function handlePay() {
    if (!user) {
      router.push('/login?next=/recharge')
      return
    }
    if (!selectedPlan) return
    try {
      setSubmitting(true)
      const order = await createRechargeOrder({ planId: selectedPlan.id, paymentMethod })
      setOrders((current) => [order, ...current].slice(0, 30))
      toast.info('订单已创建', { description: '支付网关尚未配置，订单已进入待支付状态。' })
    } catch (err) {
      toast.error('创建订单失败', { description: err?.message || '请稍后重试' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <ProfileShell active="recharge">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="label-zh text-[10px] text-celadon-700">充 值 · RECHARGE</p>
          <h1 className="mt-1 font-serif text-3xl font-semibold text-ink-900">购买额度</h1>
          <p className="mt-1 text-sm text-ink-500">额度永久有效，购买后立即到账</p>
        </div>
        <Link href="/profile" className="inline-flex h-9 items-center gap-1.5 rounded-full border border-ink-700/10 bg-rice-50 px-4 text-xs font-semibold text-ink-600 shadow-[var(--shadow-paper)] lg:hidden">
          <ArrowLeft size={13} />
          返回我的
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <section className="grid gap-3 sm:grid-cols-2">
          {loading && plans.length === 0 ? (
            <div className="card p-5 text-sm text-ink-500 sm:col-span-2">正在载入套餐...</div>
          ) : plans.map((plan) => (
            <button
              key={plan.id}
              type="button"
              onClick={() => setSelectedPlanId(plan.id)}
              className={cn(
                'card relative p-5 text-left transition hover:shadow-[var(--shadow-paper-lg)]',
                selectedPlan?.id === plan.id && 'ring-2 ring-celadon-500'
              )}
            >
              {plan.id === 'plus' && <span className="chip-verm chip absolute -top-2 right-3 px-2 py-0 text-[10px]">推荐</span>}
              <div className="font-mono text-3xl font-semibold text-ink-900">{formatPoints(plan.points)}</div>
              <div className="label-zh mt-1 text-[10px] text-ink-500">{spacedLabel(plan.label)}</div>
              <div className="ink-stroke my-3 opacity-20" />
              <div className="flex items-baseline gap-2">
                <span className="font-mono font-semibold text-celadon-700">{formatPrice(plan.amountCents)}</span>
                {plan.id === 'plus' && <span className="text-[11px] text-ink-400 line-through">¥ 60</span>}
              </div>
            </button>
          ))}
        </section>

        <aside className="card h-fit p-5">
          <div className="mb-3">
            <p className="label-zh text-[10px] text-ink-500">支 付 方 式</p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <PayMethod active={paymentMethod === 'wechat'} onClick={() => setPaymentMethod('wechat')} label="微信支付" mark="微" color="#07C160" />
            <PayMethod active={paymentMethod === 'alipay'} onClick={() => setPaymentMethod('alipay')} label="支付宝" mark="支" color="#1677FF" />
            <PayMethod active={paymentMethod === 'apple'} onClick={() => setPaymentMethod('apple')} label="Apple Pay" mark="A" color="#0E0F11" />
          </div>
          <div className="ink-stroke my-5 opacity-20" />
          <div className="rounded-2xl border border-ink-700/10 bg-rice-100 p-4 text-sm">
            <div className="mb-1.5 flex justify-between">
              <span className="text-ink-500">购买额度</span>
              <span className="font-mono font-medium">{formatPoints(selectedPlan?.points)}</span>
            </div>
            <div className="mb-1.5 flex justify-between">
              <span className="text-ink-500">折扣</span>
              <span className="font-mono text-verm-500">{selectedPlan?.id === 'plus' ? '-¥ 2' : '¥ 0'}</span>
            </div>
            <div className="ink-stroke my-2 opacity-20" />
            <div className="flex items-baseline justify-between">
              <span className="font-medium">应付</span>
              <span className="font-mono text-2xl font-semibold text-celadon-700">{formatPrice(selectedPlan?.amountCents)}</span>
            </div>
          </div>
          <button type="button" onClick={handlePay} disabled={!selectedPlan || submitting} className="btn-primary mt-5 w-full justify-center py-3 disabled:pointer-events-none disabled:opacity-60">
            {submitting ? <Loader2 size={15} className="animate-spin" /> : <CreditCard size={15} />}
            {payLabel(paymentMethod)} · {formatPrice(selectedPlan?.amountCents)}
          </button>
          <p className="mt-4 text-center text-[10px] leading-relaxed text-ink-400">
            充值即视为同意《充值协议》。额度仅用于本平台 AI 调用，不支持提现。
          </p>
          {orders.length > 0 && (
            <div className="mt-5 rounded-2xl border border-ink-700/10 bg-rice-100 p-3">
              <p className="label-zh text-[10px] text-ink-500">最 近 订 单</p>
              <div className="mt-2 space-y-2">
                {orders.slice(0, 3).map((order) => (
                  <div key={order.id} className="flex items-center justify-between gap-3 text-xs">
                    <span className="truncate font-mono text-ink-600">{order.orderNo}</span>
                    <span className="chip text-[10px]">{statusLabel(order.status)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>
    </ProfileShell>
  )
}

function PayMethod({ label, mark, color, active, onClick }) {
  return (
    <button type="button" onClick={onClick} className={`flex flex-col items-center gap-1 rounded-xl border bg-rice-50 p-3 ${active ? 'border-2 border-celadon-500' : 'border-ink-700/10'}`}>
      <span className="flex h-8 w-8 items-center justify-center rounded-lg text-xs font-semibold text-white" style={{ background: color }}>
        {mark}
      </span>
      <span className="text-xs">{label}</span>
    </button>
  )
}

function formatPoints(value) {
  return new Intl.NumberFormat('zh-CN').format(Number(value || 0))
}

function formatPrice(cents) {
  return `¥ ${Math.round(Number(cents || 0) / 100)}`
}

function spacedLabel(label = '') {
  return String(label).split('').join(' ')
}

function payLabel(method) {
  if (method === 'alipay') return '支 付 宝'
  if (method === 'apple') return 'Apple Pay'
  return '微 信 支 付'
}

function statusLabel(status) {
  return {
    pending: '待支付',
    paid: '已支付',
    cancelled: '已取消',
    expired: '已过期'
  }[status] || status || '未知'
}
