'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { ScanLine, Zap, KeyRound } from 'lucide-react'
import { fetchAuthCapabilities } from '@/lib/api'
import { isWechatBrowser, preferredOauthMode } from '@/lib/env-detect'
import LoginShell, { LoginMarketing } from '@/components/auth/LoginShell'
import MethodTabs from '@/components/auth/MethodTabs'
import WechatOneClickPanel from '@/components/auth/WechatOneClickPanel'
import WechatQrPanel from '@/components/auth/WechatQrPanel'
import LocalAuthPanel from '@/components/auth/LocalAuthPanel'

function LoginPageInner() {
  const searchParams = useSearchParams()
  const nextUrl = useMemo(() => {
    const n = searchParams?.get('next')
    if (!n || !n.startsWith('/') || n.startsWith('//')) return '/profile'
    return n
  }, [searchParams])

  const [capabilities, setCapabilities] = useState(null)
  const [method, setMethod] = useState(null) // 'oneclick' | 'qrcode' | 'local'
  const [capabilitiesError, setCapabilitiesError] = useState('')
  const [localMode, setLocalMode] = useState('login') // login | register

  useEffect(() => {
    fetchAuthCapabilities()
      .then((cap) => {
        setCapabilities(cap)
        const inWx = isWechatBrowser()
        const oneClickAvailable = inWx ? cap.wechatOauthH5 : cap.wechatOauthWeb
        // 默认顺序：一键登录 > 账号密码 > 扫码
        if (oneClickAvailable) setMethod('oneclick')
        else if (cap.local) setMethod('local')
        else setMethod('qrcode')
      })
      .catch((err) => {
        setCapabilitiesError(err.message || '能力探测失败')
        setCapabilities({
          qrcode: true,
          local: true,
          wechatOauthWeb: false,
          wechatOauthH5: false
        })
        setMethod('local')
      })
  }, [])

  const inWechat = isWechatBrowser()
  const oneClickAvailable = capabilities
    ? inWechat
      ? capabilities.wechatOauthH5
      : capabilities.wechatOauthWeb
    : false

  const tabs = useMemo(() => {
    if (!capabilities) return []
    const list = []
    if (oneClickAvailable) {
      list.push({ value: 'oneclick', label: '一键登录', icon: Zap, badge: '推荐' })
    }
    if (capabilities.local) {
      list.push({ value: 'local', label: '账号密码', icon: KeyRound })
    }
    list.push({ value: 'qrcode', label: '扫码登录', icon: ScanLine })
    return list
  }, [capabilities, oneClickAvailable])

  const heading = useMemo(() => {
    if (method === 'local' && localMode === 'register')
      return { title: '注册万模 AI', sub: '邮箱 + 密码，10 秒搞定' }
    if (method === 'local')
      return { title: '账号密码登录', sub: '使用邮箱与密码继续' }
    if (method === 'qrcode')
      return { title: '微信扫码登录', sub: '手机微信扫码确认' }
    return { title: '登录万模 AI', sub: '使用微信账号继续' }
  }, [method, localMode])

  return (
    <LoginShell>
      <LoginMarketing />

      <div className="relative w-full">
        {/* Glow backdrop */}
        <div className="pointer-events-none absolute -inset-6 rounded-[36px] bg-gradient-to-br from-indigo-500/15 via-fuchsia-500/10 to-emerald-500/10 blur-2xl" />

        <div className="relative rounded-3xl border border-white/10 bg-slate-950/60 p-5 backdrop-blur-2xl shadow-[0_24px_80px_rgba(0,0,0,0.4)] sm:p-6">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-white sm:text-lg">{heading.title}</h2>
              <p className="mt-0.5 text-[11px] text-slate-400 truncate">{heading.sub}</p>
            </div>
            {inWechat && (
              <span className="shrink-0 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-medium text-emerald-200">
                微信内打开
              </span>
            )}
          </div>

          {tabs.length > 1 && (
            <div className="mb-4">
              <MethodTabs methods={tabs} value={method} onChange={setMethod} />
            </div>
          )}

          {capabilitiesError && (
            <div className="mb-4 rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-200">
              {capabilitiesError}
            </div>
          )}

          {!capabilities ? (
            <SkeletonPanel />
          ) : method === 'oneclick' ? (
            <WechatOneClickPanel
              mode={preferredOauthMode()}
              available={capabilities}
              nextUrl={nextUrl}
              onSwitchToQrcode={() => setMethod('qrcode')}
            />
          ) : method === 'local' ? (
            <LocalAuthPanel
              mode={localMode}
              onModeChange={setLocalMode}
              nextUrl={nextUrl}
            />
          ) : (
            <WechatQrPanel nextUrl={nextUrl} />
          )}
        </div>
      </div>
    </LoginShell>
  )
}

function SkeletonPanel() {
  return (
    <div className="space-y-3">
      <div className="h-11 w-full rounded-xl skeleton" />
      <div className="h-11 w-full rounded-xl skeleton" />
      <div className="h-12 w-full rounded-2xl skeleton" />
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageInner />
    </Suspense>
  )
}
