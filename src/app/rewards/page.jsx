'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Check, Copy, Gift, PlayCircle, Share2 } from 'lucide-react'
import ProfileShell from '@/components/profile/ProfileShell'
import { toast } from '@/components/ui/sonner'
import { useAuthStore } from '@/store/useStore'

const tasks = [
  { title: '完成一次对话', desc: '使用任意模型发起对话', reward: '+100', status: '已完成', done: true },
  { title: '生成一张图片', desc: '使用图片工作台完成一张画作', reward: '+150', status: '去完成' },
  { title: '切换 3 个不同模型', desc: '体验多模型差异 · 进度 1/3', reward: '+200', status: '去体验' },
  { title: '分享一段对话', desc: '将精彩对话生成长图分享', reward: '+300', status: '去分享' }
]

export default function RewardsPage() {
  const router = useRouter()
  const user = useAuthStore((s) => s.user)
  const handleVideoReward = () => {
    if (!user) {
      router.push('/login?next=/rewards')
      return
    }
    toast.info('暂未开放', { description: 'Web 端激励视频需要接入广告 SDK 后才能发放额度。' })
  }

  return (
    <ProfileShell active="rewards">
      <TopBar title="奖励中心" subtitle="REWARDS · 砚 田" />

      <section className="relative mb-6 overflow-hidden rounded-[28px] bg-gradient-to-br from-verm-500 to-verm-600 p-7 text-rice-50 shadow-[var(--shadow-paper-lg)]">
        <div className="absolute inset-0 bg-dot-grid opacity-20" />
        <div className="relative grid gap-6 md:grid-cols-[1fr_180px] md:items-center">
          <div>
            <p className="label-zh text-[10px] opacity-80">REWARDS · 砚 田</p>
            <h1 className="mt-2 font-serif text-3xl font-semibold leading-tight md:text-4xl">
              每 一 笔 都 是 真 实 额 度
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-rice-50/80">
              观看激励视频 30 秒，立得 200 额度；今日剩余可领 <span className="font-mono font-semibold">3 / 10</span> 次。
            </p>
            <button
              type="button"
              onClick={handleVideoReward}
              className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-rice-50 px-5 text-sm font-medium text-verm-600 shadow-[var(--shadow-paper)]"
            >
              <PlayCircle size={16} />
              立 即 观 看
            </button>
          </div>
          <div className="seal flex h-28 w-28 flex-col items-center justify-center justify-self-start bg-rice-50 text-verm-500 md:justify-self-center">
            <span className="font-serif text-2xl font-bold">福</span>
            <span className="mt-1 text-[10px] tracking-widest">奉 还 砚 田</span>
          </div>
        </div>
      </section>

      <section className="mb-6 grid gap-4 md:grid-cols-3">
        <RewardCard
          label="激 励 视 频"
          badge="今日 3/10"
          title="+200"
          suffix="/ 次"
          desc="每观看 30 秒激励视频，立得 200 额度。每日 10 次封顶，重置于次日 0 时。"
          footer="已领 600 / 上限 2,000"
          action="观 看 视 频"
          onAction={handleVideoReward}
        />
        <div className="card p-5">
          <div className="mb-3 flex items-center gap-2">
            <span className="label-zh text-[10px] text-celadon-700">每 日 签 到</span>
            <span className="chip text-[10px]">连签 5 日</span>
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {[100, 100, 100, 150, 150, 200, 500].map((n, index) => (
              <div
                key={`${n}-${index}`}
                className={`flex aspect-square items-center justify-center rounded-lg text-xs font-medium ${
                  index < 5
                    ? 'bg-celadon-500 text-rice-50'
                    : index === 5
                      ? 'border-2 border-celadon-500 bg-rice-200 text-celadon-700'
                      : 'bg-rice-100 text-ink-400'
                }`}
              >
                {n}
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-ink-500">
            今日可领 <span className="font-mono font-semibold text-celadon-700">200</span> 额度，明日满 7 日双倍 500。
          </p>
          <button className="btn-primary mt-4 w-full justify-center py-2.5 text-sm">领 取 今 日</button>
        </div>
        <div className="card p-5">
          <div className="mb-3 flex items-center gap-2">
            <span className="label-zh text-[10px] text-celadon-700">邀 请 有 礼</span>
            <span className="chip-verm chip text-[10px]">双向得 5,000</span>
          </div>
          <div className="font-serif text-3xl font-semibold">+5,000<span className="ml-1 font-sans text-base text-ink-500">/ 人</span></div>
          <p className="mt-2 text-xs leading-relaxed text-ink-500">朋友通过您的链接注册并完成首次对话，双方各得 5,000 额度。</p>
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-ink-700/10 bg-rice-100 px-3 py-2.5">
            <code className="flex-1 truncate font-mono text-xs text-celadon-700">wanmo.ai/i/8X1K2P</code>
            <Copy size={13} className="text-celadon-700" />
          </div>
          <div className="mt-3 flex justify-between text-xs text-ink-500">
            <span>已邀请</span><span className="font-mono">3 人</span>
          </div>
        </div>
      </section>

      <section className="card overflow-hidden">
        <div className="border-b border-ink-700/10 px-5 py-4">
          <h2 className="font-serif font-semibold">每 日 任 务</h2>
          <p className="mt-0.5 text-[11px] text-ink-500">完成任务额外获得额度，每日 0 点刷新</p>
        </div>
        {tasks.map((task) => (
          <div key={task.title} className="ledger-row flex items-center gap-4 px-5 py-3.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-celadon-50">
              {task.done ? <Check size={15} className="text-celadon-700" /> : <span className="h-2 w-2 rounded-full bg-ink-400" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium">{task.title}</div>
              <div className="mt-0.5 text-[11px] text-ink-500">{task.desc}</div>
            </div>
            <span className="font-mono text-sm text-celadon-700">{task.reward}</span>
            <button className={task.done ? 'btn-ghost px-3 py-1.5 text-xs' : 'btn-primary px-3 py-1.5 text-xs'}>
              {task.status}
            </button>
          </div>
        ))}
      </section>
    </ProfileShell>
  )
}

function TopBar({ title, subtitle }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <div>
        <p className="label-zh text-[10px] text-celadon-700">{subtitle}</p>
        <h1 className="mt-1 font-serif text-3xl font-semibold text-ink-900">{title}</h1>
      </div>
      <Link href="/profile" className="inline-flex h-9 items-center gap-1.5 rounded-full border border-ink-700/10 bg-rice-50 px-4 text-xs font-semibold text-ink-600 shadow-[var(--shadow-paper)] lg:hidden">
        <ArrowLeft size={13} />
        返回我的
      </Link>
    </div>
  )
}

function RewardCard({ label, badge, title, suffix, desc, footer, action, onAction }) {
  return (
    <div className="card p-5">
      <div className="mb-3 flex items-center gap-2">
        <span className="label-zh text-[10px] text-celadon-700">{label}</span>
        <span className="chip-gold chip text-[10px]">{badge}</span>
      </div>
      <div className="font-serif text-3xl font-semibold">{title}<span className="ml-1 font-sans text-base text-ink-500">{suffix}</span></div>
      <p className="mt-2 text-xs leading-relaxed text-ink-500">{desc}</p>
      <div className="mt-4 h-1.5 rounded-full bg-ink-700/5">
        <div className="h-full w-[30%] rounded-full bg-celadon-500" />
      </div>
      <div className="mt-1.5 flex justify-between text-[10px] text-ink-500">
        <span>{footer}</span>
      </div>
      <button type="button" onClick={onAction} className="btn-primary mt-4 w-full justify-center py-2.5 text-sm">
        <Gift size={14} />
        {action}
      </button>
    </div>
  )
}
