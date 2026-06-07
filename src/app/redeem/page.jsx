'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, CheckCircle2, Loader2, Ticket } from 'lucide-react'
import { fetchPointsSummary, redeemCode } from '@/lib/api'
import ProfileShell from '@/components/profile/ProfileShell'
import { toast } from '@/components/ui/sonner'
import { useAuthStore } from '@/store/useStore'
import { cn } from '@/lib/utils'

export default function RedeemPage() {
  const router = useRouter()
  const [code, setCode] = useState(['', '', '', ''])
  const [loading, setLoading] = useState(false)
  const setSession = useAuthStore((s) => s.setSession)
  const user = useAuthStore((s) => s.user)
  const rawCode = code.join('').replace(/\s/g, '')
  const complete = rawCode.length >= 16

  async function handleRedeem() {
    if (!complete || loading) return
    if (!user) {
      router.push('/login?next=/redeem')
      return
    }
    try {
      setLoading(true)
      const grant = await redeemCode(rawCode)
      const points = await fetchPointsSummary()
      setSession({ user, points })
      const amount = formatPoints(grant?.ledger?.deltaPoints || grant?.deltaPoints || 0)
      toast.success('兑换成功', { description: amount ? `已到账 ${amount} 额度` : '额度已到账' })
      setCode(['', '', '', ''])
    } catch (err) {
      toast.error('兑换失败', { description: translateRedeemError(err?.message) })
    } finally {
      setLoading(false)
    }
  }

  return (
    <ProfileShell active="redeem">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="label-zh text-[10px] text-celadon-700">兑 换 · REDEEM</p>
          <h1 className="mt-1 font-serif text-3xl font-semibold text-ink-900">兑换码</h1>
          <p className="mt-1 text-sm text-ink-500">输入兑换码，额度立即到账</p>
        </div>
        <Link href="/profile" className="inline-flex h-9 items-center gap-1.5 rounded-full border border-ink-700/10 bg-rice-50 px-4 text-xs font-semibold text-ink-600 shadow-[var(--shadow-paper)] lg:hidden">
          <ArrowLeft size={13} />
          返回我的
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
        <section className="card p-5 md:p-7">
          <div className="mb-4 flex items-center gap-2">
            <Ticket size={18} className="text-celadon-700" />
            <span className="label-zh text-[10px] text-ink-500">请 输 入 16 位 兑 换 码</span>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {code.map((part, index) => (
              <input
                key={index}
                value={part}
                maxLength={4}
                onChange={(e) => {
                  const next = [...code]
                  next[index] = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '')
                  setCode(next)
                }}
                className="rounded-xl border border-ink-700/10 bg-rice-50 px-3 py-3 text-center font-mono text-base tracking-widest text-ink-900 outline-none transition focus:border-celadon-500/50 focus:bg-white"
                placeholder="····"
              />
            ))}
          </div>
          <div className="mt-4 rounded-xl border border-celadon-100 bg-celadon-50 p-3 text-xs leading-relaxed text-celadon-800">
            {complete ? '兑换码格式已完整，请确认后提交。' : '兑换码不区分大小写，每 4 位一组。'}
          </div>
          <button
            type="button"
            disabled={!complete || loading}
            onClick={handleRedeem}
            className={cn('btn-primary mt-4 w-full justify-center py-3 text-sm', (!complete || loading) && 'pointer-events-none opacity-50')}
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
            立 即 兑 换
          </button>
        </section>

        <section className="card overflow-hidden">
          <div className="border-b border-ink-700/10 px-5 py-4">
            <p className="label-zh text-[10px] text-ink-500">历 史 兑 换</p>
          </div>
          {[
            ['WM5Y · 4F2K · 8X3P · A1B2', '+5,000'],
            ['NY26 · GIFT · 8Q3W · X2K9', '+10,000'],
            ['DEMO · TRIAL · 2025 · X1Y2', '+2,000']
          ].map(([item, amount]) => (
            <div key={item} className="ledger-row flex items-center gap-2 px-4 py-3">
              <code className="flex-1 truncate font-mono text-xs text-ink-700">{item}</code>
              <span className="font-mono text-sm text-celadon-700">{amount}</span>
            </div>
          ))}
        </section>
      </div>
    </ProfileShell>
  )
}

function translateRedeemError(message) {
  const map = {
    redeem_code_invalid: '兑换码不存在，请检查后重试',
    redeem_code_used: '该兑换码已被使用',
    redeem_code_revoked: '该兑换码已被作废',
    redeem_code_expired: '该兑换码已过期',
    plan_disabled: '该兑换码对应套餐已停用',
    unauthorized: '请先登录后再兑换'
  }
  return map[message] || message || '请稍后重试'
}

function formatPoints(value) {
  const n = Number(value || 0)
  if (!Number.isFinite(n) || n <= 0) return ''
  return new Intl.NumberFormat('zh-CN').format(n)
}
