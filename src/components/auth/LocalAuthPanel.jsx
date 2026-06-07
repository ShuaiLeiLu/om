'use client'

import { useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  Mail,
  Lock,
  User as UserIcon,
  Eye,
  EyeOff,
  AlertCircle,
  Loader2,
  CheckCircle2,
  KeyRound,
  ArrowRight
} from 'lucide-react'
import { useAuthStore } from '@/store/useStore'
import {
  localLogin,
  localRegister,
  fetchMe,
  fetchPointsSummary,
  sendLocalCode
} from '@/lib/api'
import { cn } from '@/lib/utils'
import CodeField from './CodeField'

// 邮箱 + 密码本地登录面板（含注册子模式）。
//
// Props:
//  - mode: 'login' | 'register'   外部可控；不传则内部维护
//  - onModeChange: (next) => void  通知外部切换
//  - nextUrl: 登录成功后跳转的路径
export function LocalAuthPanel({ mode: externalMode, onModeChange, nextUrl = '/image' }) {
  const router = useRouter()
  const { setSession } = useAuthStore()
  const [internalMode, setInternalMode] = useState('login')
  const mode = externalMode || internalMode
  const setMode = useCallback(
    (next) => {
      onModeChange?.(next)
      if (!externalMode) setInternalMode(next)
    },
    [externalMode, onModeChange]
  )

  const [form, setForm] = useState({
    email: '',
    password: '',
    displayName: '',
    code: ''
  })
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const onField = (key) => (e) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }))

  const passwordHints = useMemo(() => evaluatePassword(form.password), [form.password])
  const emailValid = useMemo(() => isEmail(form.email), [form.email])
  const canSubmit =
    form.email.trim().length > 0 &&
    form.password.length >= 8 &&
    (mode === 'login' ||
      (passwordHints.hasLetter && passwordHints.hasDigit && form.code.length === 6))

  const handleSendCode = useCallback(async () => {
    const email = form.email.trim().toLowerCase()
    if (!emailValid) {
      setError('请先输入有效的邮箱')
      throw new Error('请先输入有效的邮箱')
    }
    return sendLocalCode({ email, purpose: 'register' })
  }, [form.email, emailValid])

  const onSubmit = async (e) => {
    e?.preventDefault?.()
    if (!canSubmit || loading) return
    setLoading(true)
    setError('')
    try {
      const payload = {
        email: form.email.trim().toLowerCase(),
        password: form.password
      }
      if (mode === 'register') {
        if (form.displayName.trim()) payload.displayName = form.displayName.trim()
        payload.code = form.code
        await localRegister(payload)
      } else {
        const result = await localLogin(payload)
        if (result?.user?.type === 'admin') {
          router.replace('/admin')
          return
        }
      }
      const [user, points] = await Promise.all([fetchMe(), fetchPointsSummary()])
      setSession({ user, points })
      router.replace(nextUrl === '/admin' ? '/image' : nextUrl)
    } catch (err) {
      setError(translateError(err?.message))
    } finally {
      setLoading(false)
    }
  }

  return (
    <form className="space-y-3" onSubmit={onSubmit} noValidate>
      <Field
        icon={Mail}
        label="邮箱"
        type="email"
        inputMode="email"
        autoCapitalize="off"
        autoCorrect="off"
        autoComplete={mode === 'login' ? 'email' : 'email'}
        placeholder="you@example.com"
        value={form.email}
        onChange={onField('email')}
      />

      {mode === 'register' && (
        <Field
          icon={UserIcon}
          label="昵称（可选）"
          placeholder="留空则用邮箱前缀"
          autoComplete="nickname"
          value={form.displayName}
          onChange={onField('displayName')}
          maxLength={32}
        />
      )}

      <PasswordField
        value={form.password}
        onChange={onField('password')}
        show={showPassword}
        onToggle={() => setShowPassword((v) => !v)}
        autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
      />

      {mode === 'register' && form.password.length > 0 && (
        <PasswordHints hints={passwordHints} />
      )}

      {mode === 'register' && (
        <CodeField
          value={form.code}
          onChange={(v) => setForm((p) => ({ ...p, code: v }))}
          canSend={emailValid}
          onSend={handleSendCode}
          onError={setError}
        />
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-verm-500/30 bg-verm-500/10 px-3 py-2 text-xs text-verm-600">
          <AlertCircle size={13} className="mt-0.5 shrink-0" />
          <span className="flex-1 break-words">{error}</span>
        </div>
      )}

      <button
        type="submit"
        disabled={!canSubmit || loading}
        className={cn(
          'group mt-1 flex w-full min-h-[48px] items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold text-white transition-all tap-transparent',
          'bg-gradient-to-br from-celadon-600 to-celadon-500',
          'shadow-[var(--shadow-ink)] hover:brightness-105 active:scale-[0.98]',
          (!canSubmit || loading) && 'opacity-50 pointer-events-none'
        )}
      >
        {loading ? (
          <Loader2 size={16} className="animate-spin" />
        ) : (
          <KeyRound size={15} />
        )}
        <span>{loading ? (mode === 'login' ? '登录中...' : '注册中...') : mode === 'login' ? '登录' : '创建账号'}</span>
        {!loading && (
          <ArrowRight
            size={14}
            className="transition-transform group-hover:translate-x-0.5"
          />
        )}
      </button>

      <div className="flex items-center justify-between pt-1 text-[11px] text-ink-500">
        <span>{mode === 'login' ? '还没有账号？' : '已经有账号了？'}</span>
        <button
          type="button"
          onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
          className="font-medium text-celadon-700 transition hover:text-celadon-500 tap-transparent"
        >
          {mode === 'login' ? '立即注册' : '直接登录'}
        </button>
      </div>
    </form>
  )
}

function Field({ icon: Icon, label, ...rest }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium text-ink-500">{label}</span>
      <div className="relative">
        {Icon && (
          <Icon
            size={14}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-500"
          />
        )}
        <input
          {...rest}
          className={cn(
            'w-full min-h-[44px] rounded-xl border border-ink-700/10 bg-rice-50 px-3.5 py-2.5 text-[16px] sm:text-[15px] text-ink-900 placeholder-ink-400 outline-none transition focus:border-celadon-500/45 focus:bg-white',
            Icon && 'pl-10'
          )}
        />
      </div>
    </label>
  )
}

function PasswordField({ value, onChange, show, onToggle, autoComplete }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium text-ink-500">密码</span>
      <div className="relative">
        <Lock
          size={14}
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-500"
        />
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          placeholder="至少 8 位，含字母与数字"
          autoComplete={autoComplete}
          className="w-full min-h-[44px] rounded-xl border border-ink-700/10 bg-rice-50 pl-10 pr-11 py-2.5 text-[16px] sm:text-[15px] text-ink-900 placeholder-ink-400 outline-none transition focus:border-celadon-500/45 focus:bg-white"
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-ink-500 transition hover:bg-ink-700/5 hover:text-ink-900 tap-transparent"
          aria-label={show ? '隐藏密码' : '显示密码'}
          tabIndex={-1}
        >
          {show ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>
    </label>
  )
}

function PasswordHints({ hints }) {
  const items = [
    { ok: hints.lengthOk, label: '至少 8 位' },
    { ok: hints.hasLetter, label: '含字母' },
    { ok: hints.hasDigit, label: '含数字' }
  ]
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 px-1 text-[10px]">
      {items.map((it) => (
        <span
          key={it.label}
          className={cn(
            'inline-flex items-center gap-1',
            it.ok ? 'text-celadon-700' : 'text-ink-400'
          )}
        >
          <CheckCircle2
            size={10}
            className={it.ok ? 'text-celadon-600' : 'text-ink-400'}
          />
          {it.label}
        </span>
      ))}
    </div>
  )
}

function evaluatePassword(pw) {
  return {
    lengthOk: pw.length >= 8,
    hasLetter: /[A-Za-z]/.test(pw),
    hasDigit: /\d/.test(pw)
  }
}

function isEmail(s) {
  return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test((s || '').trim())
}

function translateError(message) {
  if (!message) return '操作失败，请重试'
  const map = {
    invalid_email: '邮箱格式不正确',
    invalid_password: '密码格式不正确',
    invalid_credentials: '邮箱或密码不正确',
    password_too_short: '密码至少 8 位',
    password_too_long: '密码过长',
    password_too_weak: '密码需要包含字母与数字',
    email_taken: '该邮箱已被注册',
    account_disabled: '账号已被禁用',
    new_password_same_as_old: '新密码不能与旧密码相同',
    unauthorized: '请重新登录'
  }
  return map[message] || message
}

export default LocalAuthPanel
