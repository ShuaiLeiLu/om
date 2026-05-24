'use client'

import { useCallback, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, CheckCircle2, Hash, Loader2, Smartphone } from 'lucide-react'
import { fetchMe, fetchQuotaSummary, verifyLoginCode } from '@/lib/api'
import { useAuthStore } from '@/store/useStore'
import { cn } from '@/lib/utils'

export function LoginCodePanel({ nextUrl = '/profile' }) {
  const router = useRouter()
  const { setSession } = useAuthStore()
  const [digits, setDigits] = useState(['', '', '', '', '', ''])
  const [status, setStatus] = useState('idle') // idle | verifying | success | error
  const [error, setError] = useState('')
  const inputRefs = useRef([])

  const handleInput = useCallback((index, value) => {
    const char = value.replace(/\D/g, '').slice(-1)
    setDigits(prev => {
      const next = [...prev]
      next[index] = char
      return next
    })
    setError('')
    setStatus('idle')

    if (char && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }
  }, [])

  const handleKeyDown = useCallback((index, e) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }, [digits])

  const handlePaste = useCallback((e) => {
    e.preventDefault()
    const text = (e.clipboardData?.getData('text') || '').replace(/\D/g, '').slice(0, 6)
    if (!text) return
    const next = ['', '', '', '', '', '']
    for (let i = 0; i < text.length; i++) next[i] = text[i]
    setDigits(next)
    setError('')
    setStatus('idle')
    if (text.length >= 6) {
      inputRefs.current[5]?.focus()
    } else {
      inputRefs.current[text.length]?.focus()
    }
  }, [])

  const submit = useCallback(async () => {
    const code = digits.join('')
    if (code.length !== 6) {
      setError('请输入完整的 6 位登录码')
      return
    }
    setStatus('verifying')
    setError('')
    try {
      await verifyLoginCode(code)
      setStatus('success')
      const [user, quota] = await Promise.all([fetchMe(), fetchQuotaSummary()])
      setSession({ user, quota })
      router.replace(nextUrl)
    } catch (err) {
      setStatus('error')
      const msg = err.message || '验证失败'
      if (msg.includes('login_code_invalid_or_expired')) {
        setError('登录码无效或已过期，请在小程序重新生成')
      } else {
        setError(msg)
      }
    }
  }, [digits, nextUrl, router, setSession])

  // 输入满 6 位自动提交
  const fullCode = digits.join('')
  const prevFullRef = useRef('')
  if (fullCode.length === 6 && fullCode !== prevFullRef.current && status === 'idle') {
    prevFullRef.current = fullCode
    setTimeout(() => submit(), 50)
  }
  if (fullCode.length < 6) prevFullRef.current = ''

  const isVerifying = status === 'verifying'
  const isSuccess = status === 'success'

  return (
    <div className="space-y-4">
      <div>
        <p className="flex items-center gap-1.5 text-xs font-semibold text-ink-900">
          <Hash size={12} className="text-celadon-600" />
          登录码
        </p>
        <p className="mt-0.5 text-[10px] text-ink-500">
          在小程序「我的」→「客户端登录码」获取
        </p>
      </div>

      {/* 6 位输入框 */}
      <div className="flex justify-center gap-2">
        {digits.map((d, i) => (
          <input
            key={i}
            ref={el => inputRefs.current[i] = el}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={d}
            onChange={e => handleInput(i, e.target.value)}
            onKeyDown={e => handleKeyDown(i, e)}
            onPaste={i === 0 ? handlePaste : undefined}
            disabled={isVerifying || isSuccess}
            className={cn(
              'h-12 w-10 rounded-xl border text-center text-lg font-bold transition-all duration-300 outline-none',
              'bg-rice-50 text-ink-900 placeholder-ink-400 border-ink-700/10',
              'focus:border-celadon-500/50 focus:scale-105',
              isSuccess
                ? 'border-celadon-600/30 bg-celadon-50 text-celadon-700'
                : error
                  ? 'border-verm-500/30 bg-verm-500/5 text-verm-600'
                  : 'border-ink-700/10'
            )}
            autoComplete="one-time-code"
          />
        ))}
      </div>

      {/* 状态反馈 */}
      {isVerifying && (
        <div className="flex items-center justify-center gap-2 text-xs text-ink-600">
          <Loader2 size={14} className="animate-spin text-celadon-600" />
          验证中...
        </div>
      )}

      {isSuccess && (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-celadon-600/20 bg-celadon-50 px-3 py-2.5 text-xs text-celadon-700">
          <CheckCircle2 size={14} className="text-celadon-600" />
          登录成功，正在跳转...
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-verm-500/25 bg-verm-500/10 px-3 py-2.5 text-xs text-verm-600">
          <AlertCircle size={14} className="mt-0.5 shrink-0 text-verm-600" />
          <span className="break-words">{error}</span>
        </div>
      )}

      {/* 提示 */}
      <div className="flex items-start gap-2.5 rounded-xl border border-ink-700/10 bg-rice-100 px-3 py-2.5 text-[10px] text-ink-500">
        <Smartphone size={13} className="mt-0.5 shrink-0 text-ink-500" />
        <span className="leading-relaxed">
          打开小程序 →「我的」→「客户端登录码」，输入显示的 6 位数字即可登录
        </span>
      </div>
    </div>
  )
}

export default LoginCodePanel
