'use client'

import { useCallback, useMemo, useState } from 'react'
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  Loader2,
  CheckCircle2,
  KeyRound,
  ArrowLeft
} from 'lucide-react'
import { sendLocalCode, localResetPassword } from '@/lib/api'
import { cn } from '@/lib/utils'
import CodeField from './CodeField'

// 三态：input → success
//
// 流程：邮箱 → 点击「获取验证码」→ 输入验证码 + 新密码 → 提交 → 显示成功，引导回登录
export function ForgotPasswordPanel({ onBackToLogin }) {
  const [phase, setPhase] = useState('input') // input | success
  const [form, setForm] = useState({ email: '', code: '', newPassword: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const emailValid = useMemo(() => isEmail(form.email), [form.email])
  const passwordHints = useMemo(() => evaluatePassword(form.newPassword), [form.newPassword])
  const canSubmit =
    emailValid &&
    form.code.length === 6 &&
    form.newPassword.length >= 8 &&
    passwordHints.hasLetter &&
    passwordHints.hasDigit

  const onSendCode = useCallback(async () => {
    if (!emailValid) {
      setError('请先输入有效的邮箱')
      throw new Error('请先输入有效的邮箱')
    }
    return sendLocalCode({
      email: form.email.trim().toLowerCase(),
      purpose: 'reset_password'
    })
  }, [emailValid, form.email])

  const onSubmit = async (e) => {
    e?.preventDefault?.()
    if (!canSubmit || loading) return
    setLoading(true)
    setError('')
    try {
      await localResetPassword({
        email: form.email.trim().toLowerCase(),
        code: form.code,
        newPassword: form.newPassword
      })
      setPhase('success')
    } catch (err) {
      setError(translateError(err?.message))
    } finally {
      setLoading(false)
    }
  }

  if (phase === 'success') {
    return (
      <div className="space-y-4 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-celadon-50 border border-celadon-600/20">
          <CheckCircle2 size={24} className="text-celadon-600" />
        </div>
        <div>
          <p className="text-base font-semibold text-ink-900">密码已重置</p>
          <p className="mt-1.5 text-xs text-ink-500 leading-relaxed">
            请使用新密码登录万模 AI
          </p>
        </div>
        <button
          onClick={onBackToLogin}
          className="mt-2 inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-2xl border border-ink-700/10 bg-rice-50 px-5 text-sm font-medium text-ink-700 transition hover:bg-rice-100 tap-transparent"
        >
          <ArrowLeft size={13} /> 回到登录
        </button>
      </div>
    )
  }

  return (
    <form className="space-y-3" onSubmit={onSubmit} noValidate>
      <p className="text-[11px] text-ink-500 leading-relaxed">
        输入邮箱、获取验证码、设置新密码即可。
      </p>

      <label className="block">
        <span className="mb-1 block text-[11px] font-medium text-ink-500">邮箱</span>
        <div className="relative">
          <Mail
            size={14}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-500"
          />
          <input
            type="email"
            inputMode="email"
            autoCorrect="off"
            autoCapitalize="off"
            autoComplete="email"
            placeholder="you@example.com"
            value={form.email}
            onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
            className="w-full min-h-[44px] rounded-xl border border-ink-700/10 bg-rice-50 pl-10 pr-3.5 py-2.5 text-[16px] sm:text-[15px] text-ink-900 placeholder-ink-400 outline-none transition focus:border-celadon-500/45 focus:bg-white"
          />
        </div>
      </label>

      <CodeField
        value={form.code}
        onChange={(v) => setForm((p) => ({ ...p, code: v }))}
        canSend={emailValid}
        onSend={onSendCode}
        onError={setError}
      />

      <label className="block">
        <span className="mb-1 block text-[11px] font-medium text-ink-500">新密码</span>
        <div className="relative">
          <Lock
            size={14}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-500"
          />
          <input
            type={showPassword ? 'text' : 'password'}
            placeholder="至少 8 位，含字母与数字"
            autoComplete="new-password"
            value={form.newPassword}
            onChange={(e) => setForm((p) => ({ ...p, newPassword: e.target.value }))}
            className="w-full min-h-[44px] rounded-xl border border-ink-700/10 bg-rice-50 pl-10 pr-11 py-2.5 text-[16px] sm:text-[15px] text-ink-900 placeholder-ink-400 outline-none transition focus:border-celadon-500/45 focus:bg-white"
          />
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-ink-500 transition hover:bg-ink-700/5 hover:text-ink-900 tap-transparent"
            aria-label={showPassword ? '隐藏密码' : '显示密码'}
          >
            {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
      </label>

      {form.newPassword.length > 0 && (
        <div className="flex flex-wrap gap-x-3 gap-y-1 px-1 text-[10px]">
          {[
            { ok: passwordHints.lengthOk, label: '至少 8 位' },
            { ok: passwordHints.hasLetter, label: '含字母' },
            { ok: passwordHints.hasDigit, label: '含数字' }
          ].map((it) => (
            <span
              key={it.label}
              className={cn('inline-flex items-center gap-1', it.ok ? 'text-celadon-700' : 'text-ink-400')}
            >
              <CheckCircle2 size={10} className={it.ok ? 'text-celadon-600' : 'text-ink-400'} />
              {it.label}
            </span>
          ))}
        </div>
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
          'mt-1 flex w-full min-h-[48px] items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold text-white transition-all tap-transparent',
          'bg-gradient-to-br from-celadon-600 to-celadon-500',
          'shadow-[var(--shadow-ink)] hover:brightness-105 active:scale-[0.98]',
          (!canSubmit || loading) && 'opacity-50 pointer-events-none'
        )}
      >
        {loading ? <Loader2 size={16} className="animate-spin" /> : <KeyRound size={15} />}
        <span>{loading ? '重置中...' : '重置密码'}</span>
      </button>

      <button
        type="button"
        onClick={onBackToLogin}
        className="flex w-full min-h-[40px] items-center justify-center gap-1.5 rounded-xl text-xs text-ink-500 transition hover:text-celadon-700 tap-transparent"
      >
        <ArrowLeft size={11} /> 回到登录
      </button>
    </form>
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
    invalid_code: '验证码不正确',
    code_expired: '验证码已过期，请重新获取',
    code_exhausted: '尝试次数过多，请重新获取',
    password_too_short: '密码至少 8 位',
    password_too_long: '密码过长',
    password_too_weak: '密码需要包含字母与数字'
  }
  return map[message] || message
}

export default ForgotPasswordPanel
