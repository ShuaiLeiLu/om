'use client'

import { useState, useEffect, useCallback } from 'react'
import { Mail, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

// 6 位数字验证码输入框 + 右侧"获取验证码"按钮（带倒计时）
//
// Props:
//  - value: 当前验证码字符串
//  - onChange: (v) => void
//  - canSend: boolean，邮箱合法时为 true
//  - onSend: () => Promise<{ resendIntervalSeconds?: number }>
//      抛错时面板会显示错误；成功后启动倒计时
//  - onError: (msg) => void  外部展示错误
export function CodeField({ value, onChange, canSend, onSend, onError, autoComplete = 'one-time-code' }) {
  const [sending, setSending] = useState(false)
  const [countdown, setCountdown] = useState(0)

  useEffect(() => {
    if (countdown <= 0) return
    const t = window.setInterval(() => setCountdown((n) => Math.max(0, n - 1)), 1000)
    return () => window.clearInterval(t)
  }, [countdown])

  const handleSend = useCallback(async () => {
    if (sending || countdown > 0 || !canSend) return
    setSending(true)
    onError?.('')
    try {
      const result = await onSend()
      const wait = Number(result?.resendIntervalSeconds || 60)
      setCountdown(wait)
    } catch (err) {
      // 后端返回 send_too_frequent 时带 waitSeconds
      const wait = err?.waitSeconds || (err?.message?.includes('frequent') ? 60 : 0)
      if (wait) setCountdown(wait)
      onError?.(err?.message || '获取验证码失败')
    } finally {
      setSending(false)
    }
  }, [sending, countdown, canSend, onSend, onError])

  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium text-ink-500">邮箱验证码</span>
      <div className="relative flex items-stretch gap-2">
        <div className="relative flex-1">
          <Mail
            size={14}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-500"
          />
          <input
            inputMode="numeric"
            pattern="\d{6}"
            maxLength={6}
            autoComplete={autoComplete}
            placeholder="6 位数字验证码"
            value={value}
            onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
            className={cn(
              'w-full min-h-[44px] rounded-xl border border-ink-700/10 bg-rice-50 pl-10 pr-3.5 py-2.5',
              'text-[16px] sm:text-[15px] font-mono tracking-[0.4em] text-ink-900 placeholder-ink-400 outline-none transition',
              'focus:border-celadon-500/45 focus:bg-white'
            )}
          />
        </div>
        <button
          type="button"
          onClick={handleSend}
          disabled={sending || countdown > 0 || !canSend}
          className={cn(
            'shrink-0 min-w-[114px] min-h-[44px] rounded-xl px-3 text-xs font-medium transition-all tap-transparent',
            countdown > 0
              ? 'bg-rice-200 text-ink-500 border border-ink-700/10'
              : canSend && !sending
                ? 'bg-celadon-50 text-celadon-700 border border-celadon-600/20 active:scale-[0.97]'
                : 'bg-rice-200 text-ink-400 border border-ink-700/5 cursor-not-allowed'
          )}
        >
          {sending ? (
            <span className="inline-flex items-center gap-1">
              <Loader2 size={12} className="animate-spin" />
              发送中
            </span>
          ) : countdown > 0 ? (
            `${countdown}s 后重发`
          ) : (
            '获取验证码'
          )}
        </button>
      </div>
    </label>
  )
}

export default CodeField
