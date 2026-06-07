'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  fetchAdminAuditLogs,
  fetchAdminDashboard,
  fetchAdminLlmRequests,
  fetchAdminModels,
  fetchAdminPlans,
  fetchAdminPointsLedger,
  fetchAdminRedeemCodes,
  fetchAdminRechargeOrders,
  fetchAdminRewardConfig,
  fetchAdminRewardEvents,
  fetchAdminUsageEvents,
  fetchAdminUsers
} from '@/lib/api'

const ADMIN_LOGIN_URL = '/login?next=/admin'

function arrayOf(value) {
  if (Array.isArray(value)) return value
  if (Array.isArray(value?.items)) return value.items
  if (Array.isArray(value?.data)) return value.data
  return []
}

// 集中管理 admin tab 数据的 hook。
// 调用 setFilter(tabId, patch) 会触发当前 tab 重新拉取。
export function useAdminData(activeTab, isAuthed) {
  const router = useRouter()
  const [data, setData] = useState({
    dashboard: null,
    users: [],
    models: [],
    plans: [],
    codes: [],
    requests: [],
    ledger: [],
    rechargeOrders: [],
    usageEvents: [],
    rewardConfig: null,
    rewardEvents: [],
    auditLogs: []
  })
  const [filters, setFiltersState] = useState({
    users: { q: '', status: '', page: 1 },
    requests: { status: '', page: 1 },
    ledger: { type: '', page: 1 },
    audit: { action: '', page: 1 }
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const filtersRef = useRef(filters)
  filtersRef.current = filters

  const refresh = useCallback(
    async (tab) => {
      tab = tab || activeTab
      try {
        setLoading(true)
        setError('')
        const f = filtersRef.current
        if (tab === 'overview') {
          const [dashboard, requests, ledger, rewardEvents] = await Promise.all([
            fetchAdminDashboard(),
            fetchAdminLlmRequests({ pageSize: 8 }),
            fetchAdminPointsLedger({ pageSize: 8 }),
            fetchAdminRewardEvents().catch(() => [])
          ])
          setData((d) => ({
            ...d,
            dashboard,
            requests: arrayOf(requests),
            ledger: arrayOf(ledger),
            rewardEvents: arrayOf(rewardEvents)
          }))
        } else if (tab === 'users') {
          const res = await fetchAdminUsers({
            q: f.users.q,
            status: f.users.status,
            page: f.users.page,
            pageSize: 20
          })
          setData((d) => ({ ...d, users: arrayOf(res) }))
        } else if (tab === 'models') {
          const models = await fetchAdminModels()
          setData((d) => ({ ...d, models: arrayOf(models) }))
        } else if (tab === 'plans') {
          const plans = await fetchAdminPlans()
          setData((d) => ({ ...d, plans: arrayOf(plans) }))
        } else if (tab === 'codes') {
          const [plans, codes] = await Promise.all([fetchAdminPlans(), fetchAdminRedeemCodes()])
          setData((d) => ({ ...d, plans: arrayOf(plans), codes: arrayOf(codes) }))
        } else if (tab === 'requests') {
          const res = await fetchAdminLlmRequests({
            status: f.requests.status,
            page: f.requests.page,
            pageSize: 40
          })
          setData((d) => ({ ...d, requests: arrayOf(res) }))
        } else if (tab === 'ledger') {
          const res = await fetchAdminPointsLedger({
            type: f.ledger.type,
            page: f.ledger.page,
            pageSize: 40
          })
          setData((d) => ({ ...d, ledger: arrayOf(res) }))
        } else if (tab === 'recharge') {
          const orders = await fetchAdminRechargeOrders()
          setData((d) => ({ ...d, rechargeOrders: arrayOf(orders) }))
        } else if (tab === 'rewards') {
          const [config, events, usage] = await Promise.all([
            fetchAdminRewardConfig(),
            fetchAdminRewardEvents(),
            fetchAdminUsageEvents().catch(() => [])
          ])
          setData((d) => ({
            ...d,
            rewardConfig: config,
            rewardEvents: arrayOf(events),
            usageEvents: arrayOf(usage)
          }))
        } else if (tab === 'audit') {
          const res = await fetchAdminAuditLogs({
            action: f.audit.action,
            page: f.audit.page,
            pageSize: 60
          })
          setData((d) => ({ ...d, auditLogs: arrayOf(res) }))
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
    },
    [activeTab, router]
  )

  useEffect(() => {
    if (isAuthed) refresh(activeTab)
  }, [activeTab, isAuthed, refresh])

  // 调用方更新某个 tab 的 filter 并触发刷新
  const setFilter = useCallback(
    (tab, patch) => {
      setFiltersState((prev) => {
        const next = { ...prev, [tab]: { ...prev[tab], ...patch } }
        filtersRef.current = next
        return next
      })
      // 等 state commit 后再 refresh
      setTimeout(() => refresh(tab), 0)
    },
    [refresh]
  )

  // 单独写：rewards 用，setData 暴露给 form 编辑场景
  const setRewardConfig = useCallback((next) => {
    setData((d) => ({ ...d, rewardConfig: next }))
  }, [])

  return {
    data,
    filters,
    setFilter,
    setRewardConfig,
    loading,
    error,
    setError,
    refresh
  }
}
