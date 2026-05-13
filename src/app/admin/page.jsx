'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Activity,
  BadgeCheck,
  Ban,
  Boxes,
  ChevronLeft,
  ChevronRight,
  Coins,
  Copy,
  DatabaseZap,
  Gift,
  KeyRound,
  LayoutDashboard,
  Loader2,
  LogOut,
  MessageSquareText,
  PlugZap,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  Smartphone,
  ToggleLeft,
  ToggleRight,
  UserRoundCog,
  UsersRound
} from 'lucide-react'
import {
  adjustAdminQuota,
  adminLogout,
  createAdminPlan,
  createAdminRedeemCodes,
  fetchAdminAuditLogs,
  fetchAdminDashboard,
  fetchAdminLlmRequests,
  fetchAdminMe,
  fetchAdminModels,
  fetchAdminPlans,
  fetchAdminQuotaLedger,
  fetchAdminRedeemCodes,
  fetchAdminRewardConfig,
  fetchAdminRewardEvents,
  fetchAdminUsageEvents,
  fetchAdminUsers,
  fetchAdminWechatAccounts,
  revokeAdminRedeemCode,
  syncAdminSub2api,
  unbindAdminWechatAccount,
  updateAdminModel,
  updateAdminRewardConfig,
  updateAdminUserStatus
} from '@/lib/api'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

function cn(...inputs) {
  return twMerge(clsx(inputs))
}

const tabs = [
  { id: 'overview', label: '概览', icon: LayoutDashboard },
  { id: 'users', label: '用户', icon: UsersRound },
  { id: 'models', label: '模型', icon: Boxes },
  { id: 'plans', label: '套餐', icon: Gift },
  { id: 'codes', label: '兑换码', icon: KeyRound },
  { id: 'requests', label: '请求', icon: MessageSquareText },
  { id: 'ledger', label: '额度流水', icon: Coins },
  { id: 'wechat', label: '微信绑定', icon: Smartphone },
  { id: 'rewards', label: '广告奖励', icon: PlugZap },
  { id: 'audit', label: '审计', icon: ShieldCheck }
]

const ADMIN_LOGIN_URL = '/login?next=/admin'

export default function AdminPage() {
  const router = useRouter()
  const [admin, setAdmin] = useState(null)
  const [activeTab, setActiveTab] = useState('overview')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState('')
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [dashboard, setDashboard] = useState(null)
  const [users, setUsers] = useState([])
  const [models, setModels] = useState([])
  const [plans, setPlans] = useState([])
  const [codes, setCodes] = useState([])
  const [requests, setRequests] = useState([])
  const [ledger, setLedger] = useState([])
  const [usageEvents, setUsageEvents] = useState([])
  const [wechatAccounts, setWechatAccounts] = useState([])
  const [rewardConfig, setRewardConfig] = useState(null)
  const [rewardEvents, setRewardEvents] = useState([])
  const [auditLogs, setAuditLogs] = useState([])
  const [generatedCodes, setGeneratedCodes] = useState([])
  const [filters, setFilters] = useState({
    userQ: '',
    userStatus: '',
    page: 1,
    requestStatus: '',
    ledgerType: '',
    wechatQ: '',
    auditAction: ''
  })
  const [quotaForm, setQuotaForm] = useState({ userId: '', tokens: '1000', validDays: '30', remark: '后台手动调整' })
  const [planForm, setPlanForm] = useState({ name: '', tokenAmount: '100000', validDays: '30', remark: '' })
  const [codeForm, setCodeForm] = useState({ planId: '', count: '10', expiresAt: '' })

  useEffect(() => {
    let cancelled = false
    fetchAdminMe()
      .then((me) => {
        if (cancelled) return
        setAdmin(me)
      })
      .catch(() => {
        if (!cancelled) router.replace(ADMIN_LOGIN_URL)
      })
    return () => {
      cancelled = true
    }
  }, [router])

  useEffect(() => {
    if (!admin) return
    refresh(activeTab)
  }, [activeTab, admin])

  const currentTab = useMemo(() => tabs.find((tab) => tab.id === activeTab) || tabs[0], [activeTab])

  async function refresh(tab = activeTab) {
    try {
      setLoading(true)
      setError('')
      if (tab === 'overview') {
        const [nextDashboard, nextRequests, nextLedger, nextEvents] = await Promise.all([
          fetchAdminDashboard(),
          fetchAdminLlmRequests({ pageSize: 8 }),
          fetchAdminQuotaLedger({ pageSize: 8 }),
          fetchAdminRewardEvents()
        ])
        setDashboard(nextDashboard)
        setRequests(arrayOf(nextRequests))
        setLedger(arrayOf(nextLedger))
        setRewardEvents(arrayOf(nextEvents))
      }
      if (tab === 'users') {
        setUsers(arrayOf(await fetchAdminUsers({
          q: filters.userQ,
          status: filters.userStatus,
          page: filters.page,
          pageSize: 20
        })))
      }
      if (tab === 'models') setModels(arrayOf(await fetchAdminModels()))
      if (tab === 'plans') setPlans(arrayOf(await fetchAdminPlans()))
      if (tab === 'codes') {
        const [nextPlans, nextCodes] = await Promise.all([fetchAdminPlans(), fetchAdminRedeemCodes()])
        setPlans(arrayOf(nextPlans))
        setCodes(arrayOf(nextCodes))
      }
      if (tab === 'requests') {
        setRequests(arrayOf(await fetchAdminLlmRequests({ status: filters.requestStatus, pageSize: 50 })))
      }
      if (tab === 'ledger') {
        setLedger(arrayOf(await fetchAdminQuotaLedger({ type: filters.ledgerType, pageSize: 50 })))
      }
      if (tab === 'wechat') {
        setWechatAccounts(arrayOf(await fetchAdminWechatAccounts({ q: filters.wechatQ, pageSize: 50 })))
      }
      if (tab === 'rewards') {
        const [config, events, usage] = await Promise.all([
          fetchAdminRewardConfig(),
          fetchAdminRewardEvents(),
          fetchAdminUsageEvents()
        ])
        setRewardConfig(config)
        setRewardEvents(arrayOf(events))
        setUsageEvents(arrayOf(usage))
      }
      if (tab === 'audit') {
        setAuditLogs(arrayOf(await fetchAdminAuditLogs({ action: filters.auditAction, pageSize: 80 })))
      }
    } catch (err) {
      if (String(err.message || '').includes('请先登录')) {
        router.replace(ADMIN_LOGIN_URL)
        return
      }
      setError(err.message || '后台数据加载失败')
    } finally {
      setLoading(false)
    }
  }

  async function handleLogout() {
    await adminLogout().catch(() => null)
    router.replace(ADMIN_LOGIN_URL)
  }

  async function runAction(key, action, successText) {
    try {
      setSaving(key)
      setError('')
      await action()
      setToast(successText)
      window.setTimeout(() => setToast(''), 2200)
      await refresh(activeTab)
    } catch (err) {
      setError(err.message || '操作失败')
    } finally {
      setSaving('')
    }
  }

  async function submitQuota(event) {
    event.preventDefault()
    if (!quotaForm.userId || !quotaForm.tokens) {
      setError('请选择用户并填写 Token 数')
      return
    }
    await runAction('quota', () => adjustAdminQuota(quotaForm.userId, {
      tokens: quotaForm.tokens,
      validDays: Number(quotaForm.validDays || 30),
      remark: quotaForm.remark
    }), '额度已调整')
  }

  async function submitPlan(event) {
    event.preventDefault()
    await runAction('plan', () => createAdminPlan({
      name: planForm.name,
      tokenAmount: planForm.tokenAmount,
      validDays: Number(planForm.validDays || 30),
      remark: planForm.remark
    }), '套餐已创建')
    setPlanForm({ name: '', tokenAmount: '100000', validDays: '30', remark: '' })
  }

  async function submitCodes(event) {
    event.preventDefault()
    try {
      setSaving('codes')
      setError('')
      const result = await createAdminRedeemCodes({
        planId: codeForm.planId,
        count: Number(codeForm.count || 1),
        expiresAt: codeForm.expiresAt || undefined
      })
      setGeneratedCodes(arrayOf(result?.codes))
      setToast('兑换码已生成')
      await refresh('codes')
    } catch (err) {
      setError(err.message || '兑换码生成失败')
    } finally {
      setSaving('')
    }
  }

  async function saveRewardConfig(event) {
    event.preventDefault()
    await runAction('reward-config', () => updateAdminRewardConfig({
      enabled: Boolean(rewardConfig?.enabled),
      adUnitId: rewardConfig?.adUnitId || '',
      rewardTokens: rewardConfig?.rewardTokens || 0,
      dailyLimitPerUser: Number(rewardConfig?.dailyLimitPerUser || 0),
      rewardTokenValidDays: Number(rewardConfig?.rewardTokenValidDays || 1),
      minIntervalSeconds: Number(rewardConfig?.minIntervalSeconds || 0),
      sessionTtlSeconds: Number(rewardConfig?.sessionTtlSeconds || 300)
    }), '广告配置已保存')
  }

  return (
    <main className="flex h-screen overflow-hidden bg-slate-950 text-slate-50">
      <aside className={cn(
        'hidden h-full shrink-0 border-r border-slate-800 bg-slate-900/90 transition-[width] duration-200 lg:flex lg:flex-col',
        sidebarOpen ? 'w-64' : 'w-20'
      )}>
        <div className="flex h-16 items-center justify-between border-b border-slate-800 px-4">
          <div className={cn('min-w-0', !sidebarOpen && 'hidden')}>
            <p className="text-sm font-bold text-white">万模AI 后台</p>
            <p className="mt-0.5 truncate text-[11px] text-slate-500">{admin?.username || 'admin'}</p>
          </div>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-800 hover:text-white"
            aria-label="切换菜单"
          >
            {sidebarOpen ? <ChevronLeft size={17} /> : <ChevronRight size={17} />}
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {tabs.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex h-11 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium transition',
                  activeTab === tab.id ? 'bg-cyan-500/10 text-cyan-100' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100',
                  !sidebarOpen && 'justify-center px-0'
                )}
                title={tab.label}
              >
                <Icon size={18} className={activeTab === tab.id ? 'text-cyan-300' : 'text-slate-500'} />
                {sidebarOpen && <span>{tab.label}</span>}
              </button>
            )
          })}
        </nav>

        <div className="border-t border-slate-800 p-3">
          <button
            onClick={handleLogout}
            className={cn(
              'flex h-11 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium text-slate-400 transition hover:bg-red-500/10 hover:text-red-200',
              !sidebarOpen && 'justify-center px-0'
            )}
            title="退出"
          >
            <LogOut size={18} />
            {sidebarOpen && <span>退出后台</span>}
          </button>
        </div>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-800 bg-slate-950/90 px-4 backdrop-blur md:px-6">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <UserRoundCog size={14} />
              <span>Admin</span>
              <span>/</span>
              <span>{currentTab.label}</span>
            </div>
            <h1 className="mt-1 truncate text-lg font-bold text-white">{currentTab.label}</h1>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={activeTab}
              onChange={(event) => setActiveTab(event.target.value)}
              className="h-10 rounded-lg border border-slate-800 bg-slate-900 px-3 text-sm text-slate-200 outline-none lg:hidden"
            >
              {tabs.map((tab) => <option key={tab.id} value={tab.id}>{tab.label}</option>)}
            </select>
            <button
              onClick={() => refresh(activeTab)}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-800 px-3 text-sm text-slate-300 transition hover:bg-slate-900 hover:text-white"
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
              刷新
            </button>
            <button
              onClick={handleLogout}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-red-500/20 px-3 text-sm text-red-200 transition hover:bg-red-500/10 lg:hidden"
            >
              <LogOut size={15} />
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
          {toast && <div className="mb-4 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{toast}</div>}
          {error && <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>}
          {loading ? (
            <div className="flex h-[60vh] items-center justify-center text-sm text-slate-500">
              <Loader2 size={18} className="mr-2 animate-spin" />
              正在加载后台数据
            </div>
          ) : (
            <>
              {activeTab === 'overview' && (
                <Overview
                  dashboard={dashboard}
                  requests={requests}
                  ledger={ledger}
                  rewardEvents={rewardEvents}
                  onSync={() => runAction('sync', syncAdminSub2api, 'Sub2API 用量同步已触发')}
                  saving={saving}
                />
              )}
              {activeTab === 'users' && (
                <UsersPanel
                  users={users}
                  filters={filters}
                  setFilters={setFilters}
                  refresh={() => refresh('users')}
                  quotaForm={quotaForm}
                  setQuotaForm={setQuotaForm}
                  submitQuota={submitQuota}
                  saving={saving}
                  runAction={runAction}
                />
              )}
              {activeTab === 'models' && (
                <ModelsPanel models={models} saving={saving} runAction={runAction} />
              )}
              {activeTab === 'plans' && (
                <PlansPanel
                  plans={plans}
                  planForm={planForm}
                  setPlanForm={setPlanForm}
                  submitPlan={submitPlan}
                  saving={saving}
                />
              )}
              {activeTab === 'codes' && (
                <CodesPanel
                  plans={plans}
                  codes={codes}
                  codeForm={codeForm}
                  setCodeForm={setCodeForm}
                  submitCodes={submitCodes}
                  generatedCodes={generatedCodes}
                  saving={saving}
                  runAction={runAction}
                />
              )}
              {activeTab === 'requests' && (
                <RequestsPanel requests={requests} filters={filters} setFilters={setFilters} refresh={() => refresh('requests')} />
              )}
              {activeTab === 'ledger' && (
                <LedgerPanel ledger={ledger} filters={filters} setFilters={setFilters} refresh={() => refresh('ledger')} />
              )}
              {activeTab === 'wechat' && (
                <WechatPanel
                  accounts={wechatAccounts}
                  filters={filters}
                  setFilters={setFilters}
                  refresh={() => refresh('wechat')}
                  saving={saving}
                  runAction={runAction}
                />
              )}
              {activeTab === 'rewards' && (
                <RewardsPanel
                  rewardConfig={rewardConfig}
                  setRewardConfig={setRewardConfig}
                  rewardEvents={rewardEvents}
                  usageEvents={usageEvents}
                  saveRewardConfig={saveRewardConfig}
                  saving={saving}
                />
              )}
              {activeTab === 'audit' && (
                <AuditPanel logs={auditLogs} filters={filters} setFilters={setFilters} refresh={() => refresh('audit')} />
              )}
            </>
          )}
        </div>
      </section>
    </main>
  )
}

function Overview({ dashboard, requests, ledger, rewardEvents, onSync, saving }) {
  const todayRewardTokens = rewardEvents
    .filter((event) => isToday(event.createdAt) && event.result === 'granted')
    .length

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat icon={UsersRound} label="用户总数" value={formatToken(dashboard?.users)} hint={`活跃 ${formatToken(dashboard?.activeUsers)} / 7日新增 ${formatToken(dashboard?.newUsers7d)}`} />
        <Stat icon={MessageSquareText} label="模型请求" value={formatToken(dashboard?.llmRequests)} hint={`7日 ${formatToken(dashboard?.requests7d)} / 失败 ${formatToken(dashboard?.failedRequests)}`} />
        <Stat icon={Boxes} label="图片任务" value={formatToken(dashboard?.imageTasks)} hint={`7日新增 ${formatToken(dashboard?.imageTasks7d)}`} />
        <Stat icon={Coins} label="Token 净变动" value={formatToken(dashboard?.totalTokenDelta)} hint={`模型消耗 ${formatToken(dashboard?.modelUsageTokens)}`} />
        <Stat icon={Gift} label="广告奖励 Token" value={formatToken(dashboard?.adRewardTokens)} hint={`今日奖励 ${todayRewardTokens} 次`} />
        <Stat icon={Activity} label="活跃会话" value={formatToken(dashboard?.conversations)} hint="未删除对话数" />
        <Stat icon={DatabaseZap} label="存储图片" value={formatToken(dashboard?.storedImages)} hint={formatBytes(dashboard?.storageBytes)} />
        <Stat icon={BadgeCheck} label="完成请求" value={formatToken(dashboard?.completedRequests)} hint="模型网关完成量" />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-900/60 px-4 py-3">
        <div>
          <p className="text-sm font-bold text-white">Sub2API 用量同步</p>
          <p className="mt-1 text-xs text-slate-500">可手动拉取上游 usage，并据此扣减 Token。</p>
        </div>
        <button onClick={onSync} className="inline-flex h-10 items-center gap-2 rounded-lg bg-cyan-500 px-3 text-sm font-bold text-slate-950 transition hover:bg-cyan-400">
          {saving === 'sync' ? <Loader2 size={15} className="animate-spin" /> : <DatabaseZap size={15} />}
          立即同步
        </button>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <TableShell title="最近请求" badge={`${requests.length} 条`}>
          <RequestRows requests={requests.slice(0, 8)} compact />
        </TableShell>
        <TableShell title="最近额度流水" badge={`今日奖励 ${todayRewardTokens} 次`}>
          <LedgerRows ledger={ledger.slice(0, 8)} compact />
        </TableShell>
      </div>
    </div>
  )
}

function UsersPanel({ users, filters, setFilters, refresh, quotaForm, setQuotaForm, submitQuota, saving, runAction }) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-800 bg-slate-900/60 p-4">
        <Field label="搜索用户 / openid" className="min-w-[240px] flex-1">
          <div className="relative">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input value={filters.userQ} onChange={(event) => setFilters({ ...filters, userQ: event.target.value })} className="input pl-9" placeholder="昵称、openid" />
          </div>
        </Field>
        <Field label="状态">
          <select value={filters.userStatus} onChange={(event) => setFilters({ ...filters, userStatus: event.target.value })} className="input min-w-36">
            <option value="">全部</option>
            <option value="active">正常</option>
            <option value="disabled">禁用</option>
          </select>
        </Field>
        <button onClick={refresh} className="btn-secondary">筛选</button>
      </div>

      <form onSubmit={submitQuota} className="grid gap-3 rounded-lg border border-slate-800 bg-slate-900/60 p-4 lg:grid-cols-[1.5fr_1fr_1fr_1.5fr_auto] lg:items-end">
        <Field label="手动调整用户">
          <select value={quotaForm.userId} onChange={(event) => setQuotaForm({ ...quotaForm, userId: event.target.value })} className="input">
            <option value="">选择用户</option>
            {users.map((user) => <option key={user.id} value={user.id}>{user.displayName || user.id}</option>)}
          </select>
        </Field>
        <Field label="Token 增减">
          <input value={quotaForm.tokens} onChange={(event) => setQuotaForm({ ...quotaForm, tokens: event.target.value })} className="input" placeholder="-1000 或 1000" />
        </Field>
        <Field label="有效天数">
          <input value={quotaForm.validDays} onChange={(event) => setQuotaForm({ ...quotaForm, validDays: event.target.value })} className="input" type="number" min="1" />
        </Field>
        <Field label="备注">
          <input value={quotaForm.remark} onChange={(event) => setQuotaForm({ ...quotaForm, remark: event.target.value })} className="input" />
        </Field>
        <button className="btn-primary" disabled={saving === 'quota'}>
          {saving === 'quota' ? <Loader2 size={15} className="animate-spin" /> : <Coins size={15} />}
          调整
        </button>
      </form>

      <TableShell title="用户管理" badge={`${users.length} 条`}>
        {users.length === 0 ? <EmptyState text="暂无用户" /> : users.map((user) => (
          <div key={user.id} className="grid gap-3 border-b border-slate-800 px-4 py-3 last:border-b-0 xl:grid-cols-[1.2fr_0.8fr_0.8fr_auto] xl:items-center">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-semibold text-white">{user.displayName || '微信用户'}</p>
                <StatusPill value={user.status} />
              </div>
              <p className="mt-1 truncate text-xs text-slate-500">{user.id}</p>
            </div>
            <div className="text-xs text-slate-400">
              <p>微信：{user.oauthAccounts?.length || 0}</p>
              <p className="mt-1 text-slate-500">{user.oauthAccounts?.[0]?.openid || '未绑定'}</p>
            </div>
            <div className="text-xs text-slate-500">
              <p>创建：{formatDate(user.createdAt)}</p>
              <p className="mt-1">登录：{formatDate(user.lastLoginAt) || '暂无'}</p>
            </div>
            <div className="flex flex-wrap gap-2 xl:justify-end">
              <button onClick={() => setQuotaForm({ ...quotaForm, userId: user.id })} className="btn-icon" title="调整额度"><Coins size={15} /></button>
              <button
                onClick={() => runAction(`user-${user.id}`, () => updateAdminUserStatus(user.id, user.status === 'active' ? 'disabled' : 'active'), user.status === 'active' ? '用户已禁用' : '用户已启用')}
                className={cn('btn-secondary', user.status === 'active' ? 'text-red-200 hover:bg-red-500/10' : 'text-emerald-200 hover:bg-emerald-500/10')}
              >
                {saving === `user-${user.id}` ? <Loader2 size={15} className="animate-spin" /> : user.status === 'active' ? <Ban size={15} /> : <BadgeCheck size={15} />}
                {user.status === 'active' ? '禁用' : '启用'}
              </button>
            </div>
          </div>
        ))}
      </TableShell>
    </div>
  )
}

function ModelsPanel({ models, saving, runAction }) {
  const [drafts, setDrafts] = useState({})

  useEffect(() => {
    setDrafts(Object.fromEntries(models.map((model) => [model.id, {
      displayName: model.displayName || '',
      sortOrder: String(model.sortOrder ?? 0),
      remark: model.remark || ''
    }])))
  }, [models])

  return (
    <TableShell title="模型管理" badge={`${models.length} 个`}>
      {models.length === 0 ? <EmptyState text="暂无模型配置" /> : models.map((model) => {
        const draft = drafts[model.id] || {}
        return (
          <div key={model.id} className="grid gap-3 border-b border-slate-800 px-4 py-4 last:border-b-0 2xl:grid-cols-[1fr_1fr_120px_1fr_auto] 2xl:items-end">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-semibold text-white">{model.displayName}</p>
                <StatusPill value={model.enabled ? 'enabled' : 'disabled'} />
              </div>
              <p className="mt-1 truncate text-xs text-slate-500">{model.provider} / {model.sub2apiModel}</p>
            </div>
            <Field label="展示名">
              <input value={draft.displayName || ''} onChange={(event) => setDrafts({ ...drafts, [model.id]: { ...draft, displayName: event.target.value } })} className="input" />
            </Field>
            <Field label="排序">
              <input value={draft.sortOrder || ''} onChange={(event) => setDrafts({ ...drafts, [model.id]: { ...draft, sortOrder: event.target.value } })} className="input" type="number" />
            </Field>
            <Field label="备注">
              <input value={draft.remark || ''} onChange={(event) => setDrafts({ ...drafts, [model.id]: { ...draft, remark: event.target.value } })} className="input" />
            </Field>
            <div className="flex gap-2 2xl:justify-end">
              <button
                onClick={() => runAction(`model-toggle-${model.id}`, () => updateAdminModel(model.id, { enabled: !model.enabled }), model.enabled ? '模型已停用' : '模型已启用')}
                className="btn-secondary"
              >
                {model.enabled ? <ToggleRight size={16} className="text-emerald-300" /> : <ToggleLeft size={16} />}
                {model.enabled ? '停用' : '启用'}
              </button>
              <button
                onClick={() => runAction(`model-save-${model.id}`, () => updateAdminModel(model.id, {
                  displayName: draft.displayName,
                  sortOrder: Number(draft.sortOrder || 0),
                  remark: draft.remark
                }), '模型已保存')}
                className="btn-primary"
              >
                {saving === `model-save-${model.id}` ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                保存
              </button>
            </div>
          </div>
        )
      })}
    </TableShell>
  )
}

function PlansPanel({ plans, planForm, setPlanForm, submitPlan, saving }) {
  return (
    <div className="space-y-5">
      <form onSubmit={submitPlan} className="grid gap-3 rounded-lg border border-slate-800 bg-slate-900/60 p-4 lg:grid-cols-[1.4fr_1fr_1fr_1.5fr_auto] lg:items-end">
        <Field label="套餐名">
          <input value={planForm.name} onChange={(event) => setPlanForm({ ...planForm, name: event.target.value })} className="input" placeholder="月度体验包" />
        </Field>
        <Field label="Token 数">
          <input value={planForm.tokenAmount} onChange={(event) => setPlanForm({ ...planForm, tokenAmount: event.target.value })} className="input" />
        </Field>
        <Field label="有效天数">
          <input value={planForm.validDays} onChange={(event) => setPlanForm({ ...planForm, validDays: event.target.value })} className="input" type="number" min="1" />
        </Field>
        <Field label="备注">
          <input value={planForm.remark} onChange={(event) => setPlanForm({ ...planForm, remark: event.target.value })} className="input" />
        </Field>
        <button className="btn-primary" disabled={saving === 'plan'}>
          {saving === 'plan' ? <Loader2 size={15} className="animate-spin" /> : <Gift size={15} />}
          创建
        </button>
      </form>

      <TableShell title="套餐列表" badge={`${plans.length} 个`}>
        {plans.length === 0 ? <EmptyState text="暂无套餐" /> : plans.map((plan) => (
          <div key={plan.id} className="grid gap-3 border-b border-slate-800 px-4 py-3 last:border-b-0 md:grid-cols-[1fr_auto_auto_auto] md:items-center">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">{plan.name}</p>
              <p className="mt-1 truncate text-xs text-slate-500">{plan.remark || plan.id}</p>
            </div>
            <StatusPill value={plan.status} />
            <p className="text-sm font-bold text-cyan-100">{formatToken(plan.tokenAmount)} Token</p>
            <p className="text-xs text-slate-500">{plan.validDays} 天</p>
          </div>
        ))}
      </TableShell>
    </div>
  )
}

function CodesPanel({ plans, codes, codeForm, setCodeForm, submitCodes, generatedCodes, saving, runAction }) {
  return (
    <div className="space-y-5">
      <form onSubmit={submitCodes} className="grid gap-3 rounded-lg border border-slate-800 bg-slate-900/60 p-4 lg:grid-cols-[1.6fr_0.8fr_1fr_auto] lg:items-end">
        <Field label="选择套餐">
          <select value={codeForm.planId} onChange={(event) => setCodeForm({ ...codeForm, planId: event.target.value })} className="input">
            <option value="">选择套餐</option>
            {plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name} / {formatToken(plan.tokenAmount)} Token</option>)}
          </select>
        </Field>
        <Field label="数量">
          <input value={codeForm.count} onChange={(event) => setCodeForm({ ...codeForm, count: event.target.value })} className="input" type="number" min="1" max="1000" />
        </Field>
        <Field label="过期时间">
          <input value={codeForm.expiresAt} onChange={(event) => setCodeForm({ ...codeForm, expiresAt: event.target.value })} className="input" type="datetime-local" />
        </Field>
        <button className="btn-primary" disabled={saving === 'codes'}>
          {saving === 'codes' ? <Loader2 size={15} className="animate-spin" /> : <KeyRound size={15} />}
          生成
        </button>
      </form>

      {generatedCodes.length > 0 && (
        <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/10 p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-sm font-bold text-cyan-50">本次生成的明文兑换码</p>
            <button onClick={() => navigator.clipboard?.writeText(generatedCodes.join('\n'))} className="btn-secondary">
              <Copy size={15} />
              复制
            </button>
          </div>
          <textarea readOnly value={generatedCodes.join('\n')} className="h-32 w-full resize-none rounded-lg border border-cyan-500/20 bg-slate-950/70 p-3 font-mono text-xs text-cyan-50 outline-none" />
        </div>
      )}

      <TableShell title="兑换码记录" badge={`${codes.length} 条`}>
        {codes.length === 0 ? <EmptyState text="暂无兑换码" /> : codes.map((code) => (
          <div key={code.id} className="grid gap-3 border-b border-slate-800 px-4 py-3 last:border-b-0 xl:grid-cols-[1fr_auto_auto_auto] xl:items-center">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">{code.plan?.name || '未知套餐'}</p>
              <p className="mt-1 truncate text-xs text-slate-500">{code.id}</p>
            </div>
            <StatusPill value={code.status} />
            <p className="text-xs text-slate-500">过期：{formatDate(code.expiresAt) || '长期'}</p>
            <button
              onClick={() => {
                if (!window.confirm('确定撤销这个兑换码？')) return
                runAction(`code-${code.id}`, () => revokeAdminRedeemCode(code.id), '兑换码已撤销')
              }}
              disabled={code.status !== 'unused'}
              className="btn-secondary disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Ban size={15} />
              撤销
            </button>
          </div>
        ))}
      </TableShell>
    </div>
  )
}

function RequestsPanel({ requests, filters, setFilters, refresh }) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-800 bg-slate-900/60 p-4">
        <Field label="状态">
          <select value={filters.requestStatus} onChange={(event) => setFilters({ ...filters, requestStatus: event.target.value })} className="input min-w-40">
            <option value="">全部</option>
            {['pending', 'streaming', 'completed', 'failed', 'cancelled'].map((status) => <option key={status} value={status}>{status}</option>)}
          </select>
        </Field>
        <button onClick={refresh} className="btn-secondary">筛选</button>
      </div>
      <TableShell title="模型请求" badge={`${requests.length} 条`}>
        <RequestRows requests={requests} />
      </TableShell>
    </div>
  )
}

function LedgerPanel({ ledger, filters, setFilters, refresh }) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-800 bg-slate-900/60 p-4">
        <Field label="类型">
          <select value={filters.ledgerType} onChange={(event) => setFilters({ ...filters, ledgerType: event.target.value })} className="input min-w-48">
            <option value="">全部</option>
            {['redeem_code', 'ad_reward', 'manual_adjustment', 'model_usage', 'grant_expired', 'refund'].map((type) => <option key={type} value={type}>{ledgerTitle(type)}</option>)}
          </select>
        </Field>
        <button onClick={refresh} className="btn-secondary">筛选</button>
      </div>
      <TableShell title="额度流水" badge={`${ledger.length} 条`}>
        <LedgerRows ledger={ledger} />
      </TableShell>
    </div>
  )
}

function WechatPanel({ accounts, filters, setFilters, refresh, saving, runAction }) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-800 bg-slate-900/60 p-4">
        <Field label="搜索微信绑定" className="min-w-[260px] flex-1">
          <input value={filters.wechatQ} onChange={(event) => setFilters({ ...filters, wechatQ: event.target.value })} className="input" placeholder="openid、unionid、昵称" />
        </Field>
        <button onClick={refresh} className="btn-secondary">筛选</button>
      </div>
      <TableShell title="微信绑定" badge={`${accounts.length} 个`}>
        {accounts.length === 0 ? <EmptyState text="暂无微信绑定" /> : accounts.map((account) => (
          <div key={account.id} className="grid gap-3 border-b border-slate-800 px-4 py-3 last:border-b-0 xl:grid-cols-[1fr_1fr_auto] xl:items-center">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">{account.nickname || account.user?.displayName || '微信用户'}</p>
              <p className="mt-1 truncate text-xs text-slate-500">openid：{account.openid}</p>
            </div>
            <div className="min-w-0 text-xs text-slate-500">
              <p className="truncate">用户：{account.user?.id || '未关联'}</p>
              <p className="mt-1 truncate">unionid：{account.unionid || '无'}</p>
            </div>
            <button
              onClick={() => {
                if (!window.confirm('确定解绑这个微信身份？')) return
                runAction(`wechat-${account.id}`, () => unbindAdminWechatAccount(account.id), '微信身份已解绑')
              }}
              className="btn-secondary text-red-200 hover:bg-red-500/10"
            >
              {saving === `wechat-${account.id}` ? <Loader2 size={15} className="animate-spin" /> : <Ban size={15} />}
              解绑
            </button>
          </div>
        ))}
      </TableShell>
    </div>
  )
}

function RewardsPanel({ rewardConfig, setRewardConfig, rewardEvents, usageEvents, saveRewardConfig, saving }) {
  return (
    <div className="space-y-5">
      <form onSubmit={saveRewardConfig} className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
        <div className="grid gap-3 lg:grid-cols-3">
          <label className="flex h-11 items-center gap-3 rounded-lg border border-slate-800 bg-slate-950 px-3 text-sm text-slate-200">
            <input type="checkbox" checked={Boolean(rewardConfig?.enabled)} onChange={(event) => setRewardConfig({ ...rewardConfig, enabled: event.target.checked })} className="h-4 w-4 accent-cyan-400" />
            启用广告奖励
          </label>
          <Field label="广告位 ID">
            <input value={rewardConfig?.adUnitId || ''} onChange={(event) => setRewardConfig({ ...rewardConfig, adUnitId: event.target.value })} className="input" />
          </Field>
          <Field label="单次奖励 Token">
            <input value={rewardConfig?.rewardTokens || ''} onChange={(event) => setRewardConfig({ ...rewardConfig, rewardTokens: event.target.value })} className="input" />
          </Field>
          <Field label="每日上限">
            <input value={rewardConfig?.dailyLimitPerUser || ''} onChange={(event) => setRewardConfig({ ...rewardConfig, dailyLimitPerUser: event.target.value })} className="input" type="number" min="0" />
          </Field>
          <Field label="奖励有效天数">
            <input value={rewardConfig?.rewardTokenValidDays || ''} onChange={(event) => setRewardConfig({ ...rewardConfig, rewardTokenValidDays: event.target.value })} className="input" type="number" min="1" />
          </Field>
          <Field label="最小间隔秒">
            <input value={rewardConfig?.minIntervalSeconds || ''} onChange={(event) => setRewardConfig({ ...rewardConfig, minIntervalSeconds: event.target.value })} className="input" type="number" min="0" />
          </Field>
          <Field label="会话 TTL 秒">
            <input value={rewardConfig?.sessionTtlSeconds || ''} onChange={(event) => setRewardConfig({ ...rewardConfig, sessionTtlSeconds: event.target.value })} className="input" type="number" min="30" />
          </Field>
        </div>
        <button className="btn-primary mt-4" disabled={saving === 'reward-config'}>
          {saving === 'reward-config' ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
          保存广告配置
        </button>
      </form>

      <div className="grid gap-5 xl:grid-cols-2">
        <TableShell title="广告奖励事件" badge={`${rewardEvents.length} 条`}>
          {rewardEvents.length === 0 ? <EmptyState text="暂无奖励事件" /> : rewardEvents.slice(0, 80).map((event) => (
            <div key={event.id} className="grid gap-2 border-b border-slate-800 px-4 py-3 last:border-b-0 md:grid-cols-[1fr_auto_auto] md:items-center">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">{event.eventType} / {event.result}</p>
                <p className="mt-1 truncate text-xs text-slate-500">{event.openid || event.userId || event.rewardSessionId || '系统事件'}</p>
              </div>
              <StatusPill value={event.result} />
              <p className="text-xs text-slate-500">{formatDate(event.createdAt)}</p>
            </div>
          ))}
        </TableShell>
        <TableShell title="Sub2API Usage" badge={`${usageEvents.length} 条`}>
          {usageEvents.length === 0 ? <EmptyState text="暂无 usage" /> : usageEvents.slice(0, 80).map((event) => (
            <div key={event.id} className="grid gap-2 border-b border-slate-800 px-4 py-3 last:border-b-0 md:grid-cols-[1fr_auto_auto] md:items-center">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">{event.modelId || 'unknown model'}</p>
                <p className="mt-1 truncate text-xs text-slate-500">{event.sub2apiUsageId}</p>
              </div>
              <StatusPill value={event.status} />
              <p className="text-sm font-bold text-cyan-100">{formatToken(event.totalTokens)}</p>
            </div>
          ))}
        </TableShell>
      </div>
    </div>
  )
}

function AuditPanel({ logs, filters, setFilters, refresh }) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-800 bg-slate-900/60 p-4">
        <Field label="动作">
          <input value={filters.auditAction} onChange={(event) => setFilters({ ...filters, auditAction: event.target.value })} className="input min-w-48" placeholder="quota_adjust" />
        </Field>
        <button onClick={refresh} className="btn-secondary">筛选</button>
      </div>
      <TableShell title="管理员审计日志" badge={`${logs.length} 条`}>
        {logs.length === 0 ? <EmptyState text="暂无审计记录" /> : logs.map((log) => (
          <div key={log.id} className="grid gap-3 border-b border-slate-800 px-4 py-3 last:border-b-0 xl:grid-cols-[1fr_1fr_auto] xl:items-center">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">{log.action}</p>
              <p className="mt-1 truncate text-xs text-slate-500">{log.adminUser?.username || 'system'} / {log.targetType}</p>
            </div>
            <p className="truncate text-xs text-slate-500">{log.targetId || '无目标'}</p>
            <p className="text-xs text-slate-500">{formatDate(log.createdAt)}</p>
          </div>
        ))}
      </TableShell>
    </div>
  )
}

function RequestRows({ requests, compact = false }) {
  if (requests.length === 0) return <EmptyState text="暂无请求记录" />
  return requests.map((request) => (
    <div key={request.id} className={cn('grid gap-3 border-b border-slate-800 px-4 py-3 last:border-b-0', compact ? 'md:grid-cols-[1fr_auto]' : 'xl:grid-cols-[1.2fr_1fr_auto_auto]', 'xl:items-center')}>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-semibold text-white">{request.modelId}</p>
          <StatusPill value={request.status} />
        </div>
        <p className="mt-1 truncate text-xs text-slate-500">{request.requestId}</p>
      </div>
      {!compact && <p className="truncate text-xs text-slate-500">{request.user?.displayName || request.userId}</p>}
      {!compact && <p className="truncate text-xs text-slate-500">{request.errorMessage || request.sub2apiRequestId || '无异常'}</p>}
      <p className="text-xs text-slate-500">{formatDate(request.createdAt)}</p>
    </div>
  ))
}

function LedgerRows({ ledger, compact = false }) {
  if (ledger.length === 0) return <EmptyState text="暂无额度流水" />
  return ledger.map((item) => (
    <div key={item.id} className={cn('grid gap-3 border-b border-slate-800 px-4 py-3 last:border-b-0', compact ? 'md:grid-cols-[1fr_auto]' : 'xl:grid-cols-[1fr_1fr_auto_auto]', 'xl:items-center')}>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-white">{ledgerTitle(item.type)}</p>
        <p className="mt-1 truncate text-xs text-slate-500">{item.remark || item.relatedId || item.id}</p>
      </div>
      {!compact && <p className="truncate text-xs text-slate-500">{item.user?.displayName || item.userId}</p>}
      <p className={cn('text-sm font-bold', Number(item.deltaTokens || 0) >= 0 ? 'text-emerald-300' : 'text-red-300')}>
        {Number(item.deltaTokens || 0) >= 0 ? '+' : ''}{formatToken(item.deltaTokens)}
      </p>
      {!compact && <p className="text-xs text-slate-500">{formatDate(item.createdAt)}</p>}
    </div>
  ))
}

function Stat({ icon: Icon, label, value, hint }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
      <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
        <Icon size={15} className="text-cyan-300" />
        {label}
      </div>
      <p className="mt-3 text-2xl font-bold tracking-tight text-white">{value || '0'}</p>
      {hint && <p className="mt-2 truncate text-[11px] text-slate-500">{hint}</p>}
    </div>
  )
}

function TableShell({ title, badge, children }) {
  return (
    <section className="overflow-hidden rounded-lg border border-slate-800 bg-slate-900/60">
      <div className="flex items-center justify-between gap-3 border-b border-slate-800 px-4 py-3">
        <h2 className="text-sm font-bold text-white">{title}</h2>
        {badge && <span className="rounded-full border border-slate-700 px-2 py-1 text-[11px] font-medium text-slate-400">{badge}</span>}
      </div>
      <div>{children}</div>
    </section>
  )
}

function Field({ label, className, children }) {
  return (
    <label className={cn('block', className)}>
      <span className="mb-1.5 block text-xs font-semibold text-slate-400">{label}</span>
      {children}
    </label>
  )
}

function EmptyState({ text }) {
  return (
    <div className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-slate-500">
      <Activity size={16} />
      {text}
    </div>
  )
}

function StatusPill({ value }) {
  const text = statusText(value)
  const tone = statusTone(value)
  return (
    <span className={cn('inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold', tone)}>
      {text}
    </span>
  )
}

function arrayOf(value) {
  return Array.isArray(value) ? value : []
}

function formatToken(value) {
  const numberValue = Number(value || 0)
  if (!Number.isFinite(numberValue)) return String(value || 0)
  return numberValue.toLocaleString('en-US')
}

function formatDate(value) {
  if (!value) return ''
  return new Date(value).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function formatBytes(value) {
  const bytes = Number(value || 0)
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)))
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`
}

function isToday(value) {
  if (!value) return false
  const date = new Date(value)
  const now = new Date()
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate()
}

function ledgerTitle(type) {
  const map = {
    redeem_code: '兑换码',
    ad_reward: '广告奖励',
    manual_adjustment: '后台调整',
    model_usage: '模型消耗',
    grant_expired: '额度过期',
    refund: '退款'
  }
  return map[type] || type || '未知'
}

function statusText(value) {
  const map = {
    active: '正常',
    disabled: '停用',
    enabled: '启用',
    unused: '未使用',
    used: '已使用',
    revoked: '已撤销',
    expired: '已过期',
    completed: '完成',
    failed: '失败',
    pending: '等待',
    streaming: '流式',
    cancelled: '取消',
    granted: '已发放',
    rejected: '已拒绝',
    charged: '已扣费',
    matched: '已匹配',
    unmatched: '未匹配',
    ignored: '忽略'
  }
  return map[value] || value || '未知'
}

function statusTone(value) {
  if (['active', 'enabled', 'completed', 'granted', 'charged', 'matched', 'unused'].includes(String(value))) {
    return 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200'
  }
  if (['disabled', 'failed', 'revoked', 'rejected', 'expired', 'cancelled'].includes(String(value))) {
    return 'border-red-500/20 bg-red-500/10 text-red-200'
  }
  return 'border-slate-700 bg-slate-800/70 text-slate-300'
}
