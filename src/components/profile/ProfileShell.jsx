'use client'

import Link from 'next/link'
import { Coins, Gift, Image as ImageIcon, MessageSquare, PlayCircle, Settings, Ticket, User } from 'lucide-react'
import { cn } from '@/lib/utils'

export function ProfileShell({ active = 'profile', children }) {
  return (
    <main className="min-h-screen bg-rice-100 text-ink-900 paper">
      <div className="grid min-h-screen lg:grid-cols-[260px_1fr]">
        <aside className="hidden border-r border-ink-700/10 bg-rice-50 p-4 lg:block">
          <div className="mb-6 flex items-center gap-2 px-1">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-celadon-600 to-celadon-500">
              <span className="font-serif font-bold text-rice-50">万</span>
            </div>
            <div className="font-serif font-semibold">万模 AI</div>
          </div>
          <nav className="space-y-1 text-sm">
            <ProfileNavItem href="/chat" icon={MessageSquare} label="对话" active={active === 'chat'} />
            <ProfileNavItem href="/image" icon={ImageIcon} label="绘图" active={active === 'image'} />
            <ProfileNavItem href="/profile" icon={Coins} label="个人中心" active={active === 'profile'} />
            <ProfileNavItem href="/rewards" icon={PlayCircle} label="看视频得额度" active={active === 'rewards'} />
            <ProfileNavItem href="/redeem" icon={Ticket} label="兑换码" active={active === 'redeem'} />
            <ProfileNavItem href="/recharge" icon={Gift} label="充值" active={active === 'recharge'} />
            <ProfileNavItem icon={Settings} label="设置" active={active === 'settings'} />
          </nav>
        </aside>
        <div className="min-w-0 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
          <div className="relative z-10 mx-auto max-w-5xl pb-16 lg:pb-0">{children}</div>
        </div>
      </div>
      <ProfileMobileTabbar active={active} />
    </main>
  )
}

function ProfileNavItem({ href, icon: Icon, label, active = false }) {
  const className = cn(
    'flex min-h-10 items-center gap-2 rounded-xl px-3 py-2 transition',
    active
      ? 'border border-celadon-100 bg-celadon-50 font-medium text-celadon-800'
      : 'text-ink-500 hover:bg-ink-700/5 hover:text-ink-900'
  )
  const content = (
    <>
      {Icon && <Icon size={15} />}
      <span>{label}</span>
    </>
  )
  if (href) {
    return (
      <Link href={href} className={className}>
        {content}
      </Link>
    )
  }
  return <div className={className}>{content}</div>
}

function ProfileMobileTabbar({ active }) {
  const items = [
    { href: '/chat', label: '对话', icon: MessageSquare, id: 'chat' },
    { href: '/image', label: '绘图', icon: ImageIcon, id: 'image' },
    { href: '/rewards', label: '奖励', icon: Gift, id: 'rewards' },
    { href: '/profile', label: '我的', icon: User, id: 'profile' }
  ]
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex h-16 items-center justify-around border-t border-ink-700/10 bg-rice-50/95 px-2 pb-safe backdrop-blur-xl lg:hidden">
      {items.map((item) => {
        const Icon = item.icon
        const isActive = item.id === active || (item.id === 'profile' && ['redeem', 'recharge'].includes(active))
        return (
          <Link
            key={item.id}
            href={item.href}
            className={cn(
              'flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl py-1 text-[10px] transition tap-transparent',
              isActive ? 'text-celadon-700' : 'text-ink-500'
            )}
          >
            <Icon size={20} />
            <span>{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}

export default ProfileShell
