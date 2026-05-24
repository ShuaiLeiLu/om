'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { LogOut, Menu, RefreshCw, X } from 'lucide-react'
import { cn } from '@/lib/utils'

const TAB_ORDINALS = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一']

const TAB_LABEL_OVERRIDES = {
  requests: '模型请求',
  ledger: '账本',
  recharge: '充值',
  wechat: '微信'
}

function tabTitle(tab, index) {
  return `${TAB_ORDINALS[index] || index + 1} · ${TAB_LABEL_OVERRIDES[tab.id] || tab.label}`
}

export default function AdminShell({
  tabs,
  activeTab,
  onChangeTab,
  admin,
  onLogout,
  onRefresh,
  loading,
  toast,
  error,
  children
}) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 1024)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const current = tabs.find((t) => t.id === activeTab) || tabs[0]

  const handleChangeTab = (id) => {
    onChangeTab(id)
    if (isMobile) setMobileOpen(false)
  }

  return (
    <div className="relative flex h-screen-dvh w-full flex-col overflow-hidden bg-rice-100 text-ink-900 paper">
      <header className="shrink-0 border-b border-ink-700/10 bg-rice-50/94 px-3 backdrop-blur-xl pl-safe pr-safe md:px-6">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-3 py-3.5">
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/image" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-celadon-600 to-celadon-500 text-rice-50 shadow-[var(--shadow-ink)]">
              <span className="font-serif text-lg font-bold">万</span>
            </Link>
            <div className="min-w-0">
              <p className="font-serif text-base font-semibold leading-none text-ink-900">司 理 处</p>
              <p className="mt-0.5 truncate text-[10px] tracking-widest text-ink-500">WANMO · ADMIN</p>
            </div>
          </div>

          <div className="hidden min-w-0 items-center gap-3 text-xs text-ink-500 md:flex">
            <span>在职 · <span className="font-medium text-ink-800">{admin?.username || 'admin'}</span></span>
            <span className="chip"><span className="h-1.5 w-1.5 rounded-full bg-celadon-500" /> 服务正常</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onRefresh}
              disabled={loading}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-ink-700/10 bg-rice-50 px-3 text-xs text-ink-700 shadow-[var(--shadow-paper)] transition hover:bg-rice-100 disabled:opacity-50 tap-transparent"
            >
              <RefreshCw size={13} className={cn(loading && 'animate-spin')} />
              <span className="hidden sm:inline">刷新</span>
            </button>
            <button
              onClick={onLogout}
              className="hidden h-10 items-center gap-1.5 rounded-xl border border-verm-500/20 bg-verm-500/5 px-3 text-xs font-medium text-verm-600 transition hover:bg-verm-500/10 sm:inline-flex"
            >
              <LogOut size={13} />
              退出
            </button>
            <button
              onClick={() => setMobileOpen(true)}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-ink-700/10 bg-rice-50 text-ink-700 lg:hidden"
              aria-label="菜单"
            >
              <Menu size={18} />
            </button>
          </div>
        </div>

        <nav className="mx-auto hidden max-w-[1400px] items-end gap-0 overflow-x-auto scrollbar-thin lg:flex">
          {tabs.map((tab, index) => {
            const active = tab.id === activeTab
            return (
              <button
                key={tab.id}
                onClick={() => handleChangeTab(tab.id)}
                className={cn(
                  'relative shrink-0 px-4 py-3 text-sm transition tap-transparent',
                  active
                    ? 'font-medium text-celadon-700'
                    : 'text-ink-500 hover:text-ink-900'
                )}
              >
                {tabTitle(tab, index)}
                {active && <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-celadon-500" />}
              </button>
            )
          })}
        </nav>
      </header>

      {isMobile && mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button className="absolute inset-0 bg-ink-900/35 backdrop-blur-sm" onClick={() => setMobileOpen(false)} aria-label="关闭菜单" />
          <div className="absolute bottom-0 left-0 right-0 max-h-[80dvh] overflow-y-auto rounded-t-[28px] border border-ink-700/10 bg-rice-50 p-3 shadow-[var(--shadow-paper-lg)] pb-safe">
            <div className="mb-2 flex items-center justify-between px-1">
              <span className="text-[10px] text-ink-500 label-zh">司 理 处</span>
              <button onClick={() => setMobileOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-xl text-ink-500 hover:bg-ink-700/5" aria-label="关闭">
                <X size={16} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {tabs.map((tab, index) => {
                const Icon = tab.icon
                const active = tab.id === activeTab
                return (
                  <button
                    key={tab.id}
                    onClick={() => handleChangeTab(tab.id)}
                    className={cn(
                      'flex min-h-11 items-center gap-2 rounded-xl border px-3 text-sm',
                      active ? 'border-celadon-200 bg-celadon-50 text-celadon-800' : 'border-ink-700/10 bg-rice-50 text-ink-600'
                    )}
                  >
                    <Icon size={15} />
                    {tabTitle(tab, index)}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      <main className="flex min-h-0 flex-1 flex-col">
        {(error || toast) && (
          <div className="mx-auto w-full max-w-[1400px] px-3 pt-3 md:px-6">
            {error && (
              <div className="rounded-2xl border border-verm-500/30 bg-verm-500/10 px-4 py-2.5 text-xs text-verm-600">
                {error}
              </div>
            )}
            {toast && (
              <div className="mt-2 rounded-2xl border border-celadon-600/30 bg-celadon-50 px-4 py-2.5 text-xs text-celadon-700">
                {toast}
              </div>
            )}
          </div>
        )}

        <div className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col overflow-y-auto px-3 py-4 pb-safe scrollbar-thin md:px-6 md:py-6">
          <div className="mb-4">
            <p className="text-[10px] text-celadon-700 label-zh">卷 之 {TAB_ORDINALS[tabs.findIndex((t) => t.id === current.id)] || '一'}</p>
            <h1 className="mt-1 font-serif text-2xl font-semibold text-ink-900">{TAB_LABEL_OVERRIDES[current.id] || current.label}</h1>
          </div>
          {children}
        </div>
      </main>
    </div>
  )
}
