'use client'

import { Suspense, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import LoginShell, { LoginMarketing } from '@/components/auth/LoginShell'
import CasdoorUnifiedPanel from '@/components/auth/CasdoorUnifiedPanel'

const DEFAULT_AFTER_LOGIN = '/image'

function LoginPageInner() {
  const searchParams = useSearchParams()
  const nextUrl = useMemo(() => {
    const n = searchParams?.get('next')
    if (!n || !n.startsWith('/') || n.startsWith('//')) return DEFAULT_AFTER_LOGIN
    return n
  }, [searchParams])

  return (
    <LoginShell>
      <LoginMarketing />

      <div className="relative w-full animate-in">
        <div className="relative rounded-[28px] border border-ink-700/10 bg-rice-50 p-6 shadow-[var(--shadow-paper-lg)] sm:p-8 ricepaper">
          <div className="mb-5 min-w-0">
            <h2 className="font-serif text-lg font-semibold text-ink-900 tracking-tight sm:text-xl">统一账号登录</h2>
            <p className="mt-1 text-[11px] text-ink-500 tracking-wide truncate">使用 Casdoor 账号继续</p>
          </div>
          <CasdoorUnifiedPanel nextUrl={nextUrl} />
        </div>
      </div>
    </LoginShell>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageInner />
    </Suspense>
  )
}
