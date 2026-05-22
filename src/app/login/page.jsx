'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { ScanLine, Zap, KeyRound, Hash } from 'lucide-react'
import { fetchAuthCapabilities } from '@/lib/api'
import { isWechatBrowser, preferredOauthMode } from '@/lib/env-detect'
import LoginShell, { LoginMarketing } from '@/components/auth/LoginShell'
import MethodTabs from '@/components/auth/MethodTabs'
import WechatOneClickPanel from '@/components/auth/WechatOneClickPanel'
import WechatQrPanel from '@/components/auth/WechatQrPanel'
import LoginCodePanel from '@/components/auth/LoginCodePanel'
import LocalAuthPanel from '@/components/auth/LocalAuthPanel'
import ForgotPasswordPanel from '@/components/auth/ForgotPasswordPanel'

const DEFAULT_AFTER_LOGIN = '/image'

function LoginPageInner() {
  const searchParams = useSearchParams()
  const nextUrl = useMemo(() => {
    const n = searchParams?.get('next')
    if (!n || !n.startsWith('/') || n.startsWith('//')) return DEFAULT_AFTER_LOGIN
    return n
  }, [searchParams])

  const [capabilities, setCapabilities] = useState(null)
  const [method, setMethod] = useState(null) // 'oneclick' | 'qrcode' | 'logincode' | 'local' | 'forgot'
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
    list.push({ value: 'logincode', label: '登录码', icon: Hash })
    return list
  }, [capabilities, oneClickAvailable])

  const heading = useMemo(() => {
    if (method === 'forgot')
      return { title: '找回密码', sub: '通过邮箱验证码重置' }
    if (method === 'local' && localMode === 'register')
      return { title: '注册万模 AI', sub: '邮箱 + 验证码 + 密码' }
    if (method === 'local')
      return { title: '账号密码登录', sub: '使用邮箱与密码继续' }
    if (method === 'logincode')
      return { title: '登录码登录', sub: '输入小程序中的 6 位数字' }
    if (method === 'qrcode')
      return { title: '微信扫码登录', sub: '手机微信扫码即可登录' }
    return { title: '登录万模 AI', sub: '使用微信账号继续' }
  }, [method, localMode])

  return (
    <LoginShell>
      <LoginMarketing />

      <div className="relative w-full animate-in">
        {/* Glow backdrop */}
        <div className="pointer-events-none absolute -inset-8 rounded-[40px] bg-gradient-to-br from-indigo-500/20 via-purple-500/15 to-fuchsia-500/15 blur-3xl opacity-80" />

        <div className="relative rounded-3xl border border-white/10 bg-slate-950/40 p-6 backdrop-blur-3xl shadow-[0_32px_100px_rgba(0,0,0,0.5)] sm:p-8 neon-border transition-all duration-500 hover:border-white/15">
          <div className="mb-5 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-white tracking-tight sm:text-xl">{heading.title}</h2>
              <p className="mt-1 text-[11px] text-slate-400 tracking-wide truncate">{heading.sub}</p>
            </div>
            {inWechat && (
              <span className="shrink-0 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-medium text-emerald-200">
                微信内打开
              </span>
            )}
          </div>

          {tabs.length > 1 && method !== 'forgot' && (
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
          ) : method === 'forgot' ? (
            <ForgotPasswordPanel onBackToLogin={() => setMethod('local')} />
          ) : method === 'logincode' ? (
            <LoginCodePanel nextUrl={nextUrl} />
          ) : method === 'local' ? (
            <>
              <LocalAuthPanel
                mode={localMode}
                onModeChange={setLocalMode}
                nextUrl={nextUrl}
              />
              {localMode === 'login' && (
                <div className="mt-3 text-center">
                  <button
                    type="button"
                    onClick={() => setMethod('forgot')}
                    className="text-[11px] font-medium text-slate-400 transition hover:text-fuchsia-300 tap-transparent"
                  >
                    忘记密码？
                  </button>
                </div>
              )}
            </>
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
