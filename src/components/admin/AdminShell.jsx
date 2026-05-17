'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  ChevronLeft,
  ChevronRight,
  LogOut,
  Menu,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  X
} from 'lucide-react'
import { cn } from '@/lib/utils'

// Admin 整体布局：左侧栏（rail 可折叠）+ 顶栏 + 内容区。
// 与主站 Shell 共用一套色系 / 玻璃态 / 光晕基调。
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
  const [collapsed, setCollapsed] = useState(false)
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
    <div className="relative flex h-screen-dvh w-full overflow-hidden text-slate-50">
      {/* Admin 专属环境光，避免被 sidebar 完全盖住 body 的渐变 */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          backgroundImage: [
            'radial-gradient(900px 540px at 8% 0%, rgba(99, 102, 241, 0.16), transparent 55%)',
            'radial-gradient(1100px 600px at 100% 110%, rgba(217, 70, 239, 0.14), transparent 55%)',
            'radial-gradient(700px 500px at 60% 40%, rgba(56, 189, 248, 0.07), transparent 60%)'
          ].join(', ')
        }}
      />

      {isMobile && mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm animate-fade-in"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 transform transition-[width,transform] duration-300 ease-in-out lg:relative lg:translate-x-0',
          'border-r border-white/8 bg-slate-950/60 backdrop-blur-2xl pl-safe',
          isMobile
            ? mobileOpen
              ? 'translate-x-0 w-[84vw] max-w-[300px]'
              : '-translate-x-full lg:hidden'
            : collapsed
              ? 'w-16'
              : 'w-64'
        )}
      >
        <div className="flex h-full flex-col p-3 pt-safe">
          <div
            className={cn(
              'mb-4 flex items-center gap-2',
              collapsed && !isMobile ? 'flex-col' : 'justify-between'
            )}
          >
            <Link
              href="/"
              className={cn(
                'flex items-center gap-2 rounded-xl py-1.5 tap-transparent',
                collapsed && !isMobile ? 'justify-center w-full' : 'flex-1 min-w-0'
              )}
              title="返回主站"
            >
              <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-indigo-500 to-fuchsia-500 shadow-[0_8px_24px_rgba(99,102,241,0.35)]">
                <div className="absolute inset-0 flex items-center justify-center">
                  <ShieldCheck className="text-white" size={17} />
                </div>
              </div>
              {!(collapsed && !isMobile) && (
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold tracking-tight">
                    <span className="text-gradient-brand">管理后台</span>
                  </p>
                  <p className="truncate text-[10px] text-slate-500">{admin?.username || 'admin'}</p>
                </div>
              )}
            </Link>

            {!isMobile && (
              <button
                onClick={() => setCollapsed((v) => !v)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white/5 hover:text-slate-100 tap-transparent"
                aria-label={collapsed ? '展开侧栏' : '收起侧栏'}
              >
                {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
              </button>
            )}

            {isMobile && (
              <button
                onClick={() => setMobileOpen(false)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-white/5 tap-transparent"
                aria-label="关闭菜单"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <nav className="flex-1 space-y-1 overflow-y-auto scrollbar-thin">
            {tabs.map((tab) => {
              const Icon = tab.icon
              const active = tab.id === activeTab
              const isCollapsed = collapsed && !isMobile
              return (
                <button
                  key={tab.id}
                  onClick={() => handleChangeTab(tab.id)}
                  title={isCollapsed ? tab.label : undefined}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-xl text-sm font-medium transition-all tap-transparent',
                    active
                      ? 'bg-gradient-to-br from-indigo-500/35 to-fuchsia-500/25 text-white border border-white/12 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]'
                      : 'text-slate-400 hover:bg-white/5 hover:text-slate-100 border border-transparent',
                    isCollapsed ? 'h-10 w-10 mx-auto justify-center' : 'h-10 px-3'
                  )}
                >
                  <Icon size={15} className={active ? 'text-fuchsia-300' : 'text-slate-500'} />
                  {!isCollapsed && <span className="truncate">{tab.label}</span>}
                </button>
              )
            })}
          </nav>

          <div className="mt-2 border-t border-white/5 pt-3 pb-safe">
            <button
              onClick={onLogout}
              className={cn(
                'flex w-full min-h-[40px] items-center gap-3 rounded-xl text-sm font-medium text-slate-400 transition hover:bg-rose-500/10 hover:text-rose-300 tap-transparent',
                collapsed && !isMobile ? 'justify-center px-0' : 'px-3'
              )}
              title="退出登录"
            >
              <LogOut size={15} />
              {!(collapsed && !isMobile) && <span>退出后台</span>}
            </button>
          </div>
        </div>
      </aside>

      <main className="relative z-10 flex flex-1 flex-col min-w-0">
        <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-white/8 bg-slate-950/40 px-3 backdrop-blur-2xl pl-safe pr-safe md:h-16 md:px-6">
          <button
            onClick={() => setMobileOpen(true)}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-300 hover:bg-white/5 lg:hidden tap-transparent"
            aria-label="菜单"
          >
            <Menu size={18} />
          </button>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
              <Sparkles size={11} className="text-fuchsia-300" />
              <span>Admin</span>
              <span className="opacity-40">/</span>
              <span>{current.label}</span>
            </div>
            <h1 className="mt-0.5 truncate text-base font-bold md:text-lg">
              <span className="text-gradient-brand">{current.label}</span>
            </h1>
          </div>

          <button
            onClick={onRefresh}
            disabled={loading}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-xs text-slate-200 transition hover:bg-white/[0.08] disabled:opacity-50 tap-transparent"
          >
            <RefreshCw size={13} className={cn(loading && 'animate-spin')} />
            <span className="hidden sm:inline">刷新</span>
          </button>
        </header>

        {(error || toast) && (
          <div className="px-3 pt-3 md:px-6">
            {error && (
              <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-2.5 text-xs text-rose-200 backdrop-blur-xl">
                ⚠ {error}
              </div>
            )}
            {toast && (
              <div className="mt-2 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-2.5 text-xs text-emerald-200 backdrop-blur-xl">
                ✓ {toast}
              </div>
            )}
          </div>
        )}

        <div className="flex-1 overflow-y-auto scrollbar-thin px-3 py-4 pb-safe md:px-6 md:py-6">
          {children}
        </div>
      </main>
    </div>
  )
}
