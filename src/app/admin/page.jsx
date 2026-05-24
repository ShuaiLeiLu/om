'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Boxes,
  Coins,
  Gift,
  KeyRound,
  LayoutDashboard,
  Loader2,
  MessageSquareText,
  PlugZap,
  ShieldCheck,
  Smartphone,
  UsersRound
} from 'lucide-react'
import { adminLogout, fetchAdminMe } from '@/lib/api'
import AdminShell from '@/components/admin/AdminShell'
import { useAdminData } from '@/components/admin/useAdminData'
import OverviewTab from '@/components/admin/tabs/OverviewTab'
import UsersTab from '@/components/admin/tabs/UsersTab'
import ModelsTab from '@/components/admin/tabs/ModelsTab'
import PlansTab from '@/components/admin/tabs/PlansTab'
import CodesTab from '@/components/admin/tabs/CodesTab'
import RequestsTab from '@/components/admin/tabs/RequestsTab'
import LedgerTab from '@/components/admin/tabs/LedgerTab'
import WechatTab from '@/components/admin/tabs/WechatTab'
import RewardsTab from '@/components/admin/tabs/RewardsTab'
import AuditTab from '@/components/admin/tabs/AuditTab'

const ADMIN_LOGIN_URL = '/login?next=/admin'

const TABS = [
  { id: 'overview', label: '概览', icon: LayoutDashboard, component: OverviewTab },
  { id: 'users', label: '用户', icon: UsersRound, component: UsersTab },
  { id: 'models', label: '模型', icon: Boxes, component: ModelsTab },
  { id: 'plans', label: '套餐', icon: Gift, component: PlansTab },
  { id: 'codes', label: '兑换码', icon: KeyRound, component: CodesTab },
  { id: 'requests', label: 'LLM 请求', icon: MessageSquareText, component: RequestsTab },
  { id: 'ledger', label: '额度流水', icon: Coins, component: LedgerTab },
  { id: 'wechat', label: '微信绑定', icon: Smartphone, component: WechatTab },
  { id: 'rewards', label: '广告奖励', icon: PlugZap, component: RewardsTab },
  { id: 'audit', label: '审计日志', icon: ShieldCheck, component: AuditTab }
]

export default function AdminPage() {
  const router = useRouter()
  const [admin, setAdmin] = useState(null)
  const [activeTab, setActiveTab] = useState('overview')
  const [saving, setSaving] = useState('')
  const [toast, setToast] = useState('')

  const {
    data,
    filters,
    setFilter,
    setRewardConfig,
    loading,
    error,
    setError,
    refresh
  } = useAdminData(activeTab, !!admin)

  useEffect(() => {
    let cancelled = false
    fetchAdminMe()
      .then((me) => !cancelled && setAdmin(me))
      .catch(() => !cancelled && router.replace(ADMIN_LOGIN_URL))
    return () => {
      cancelled = true
    }
  }, [router])

  const handleLogout = useCallback(async () => {
    await adminLogout().catch(() => null)
    router.replace(ADMIN_LOGIN_URL)
  }, [router])

  const runAction = useCallback(
    async (key, action, successText) => {
      try {
        setSaving(key)
        setError('')
        await action()
        setToast(successText || '操作成功')
        window.setTimeout(() => setToast(''), 2200)
        await refresh(activeTab)
      } catch (err) {
        setError(err.message || '操作失败')
      } finally {
        setSaving('')
      }
    },
    [activeTab, refresh, setError]
  )

  if (!admin) {
    return (
      <div className="flex h-screen-dvh items-center justify-center bg-rice-100 text-ink-500 paper">
        <Loader2 className="mr-2 animate-spin text-celadon-600" size={18} />
        正在校验管理员身份...
      </div>
    )
  }

  const current = TABS.find((t) => t.id === activeTab) || TABS[0]
  const TabComponent = current.component

  return (
    <AdminShell
      tabs={TABS}
      activeTab={activeTab}
      onChangeTab={setActiveTab}
      admin={admin}
      onLogout={handleLogout}
      onRefresh={() => refresh(activeTab)}
      loading={loading}
      toast={toast}
      error={error}
    >
      <TabComponent
        data={data}
        filters={filters}
        setFilter={setFilter}
        setRewardConfig={setRewardConfig}
        runAction={runAction}
        saving={saving}
        loading={loading}
        setError={setError}
        refresh={refresh}
      />
    </AdminShell>
  )
}
