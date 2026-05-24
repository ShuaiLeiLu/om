'use client'

import Link from 'next/link'
import { ArrowRight, AlertCircle, RefreshCw, Inbox } from 'lucide-react'
import { getGreeting } from '@/lib/model-badges'
import ProviderGrid from './ProviderGrid'

const DOMESTIC_PROVIDER_IDS = new Set(['deepseek', 'qwen', 'zhipu', 'moonshot'])

const MARKET_PROMPTS = [
  '帮我读懂这篇论文',
  '起草一封商务邮件',
  '画一只青瓷小鹿',
  '解释这段代码',
  '制定旅行行程',
  '推荐一首古诗'
]

export function ChatLanding({
  providers,
  loadingModels,
  modelsError,
  isAuthenticated,
  user,
  onSelectProvider,
  onRetry
}) {
  const greeting = getGreeting()
  const heroName = isAuthenticated ? user?.displayName : null
  const totalModels = providers.reduce((a, p) => a + (p.models?.length || 0), 0)
  const showSkeleton = loadingModels && providers.length === 0
  const showEmpty = !loadingModels && !modelsError && providers.length === 0
  const showError = !loadingModels && !!modelsError
  const domesticProviders = providers.filter((p) => DOMESTIC_PROVIDER_IDS.has(p.id))
  const globalProviders = providers.filter((p) => !DOMESTIC_PROVIDER_IDS.has(p.id))

  return (
    <>
      <div className="mb-7 flex flex-col gap-5 md:mb-8 md:flex-row md:items-end md:justify-between rounded-[28px] border border-ink-700/10 bg-rice-50 p-6 shadow-[var(--shadow-paper)] relative overflow-hidden ricepaper">
        <div className="pointer-events-none absolute bottom-0 right-0 h-28 w-56 opacity-40">
          <svg viewBox="0 0 320 120" className="h-full w-full">
            <path d="M0 100 C50 45 92 84 132 52 C178 18 212 65 252 36 C282 15 302 22 320 32 V120 H0Z" fill="#A5CCC4" opacity=".55" />
            <path d="M0 108 C60 62 90 94 142 64 C190 38 216 78 260 52 C290 35 306 42 320 50 V120 H0Z" fill="#5BA5A0" opacity=".38" />
            <path d="M0 116 C70 82 120 100 165 76 C210 54 240 86 282 66 C302 56 314 60 320 64 V120 H0Z" fill="#1F6B66" opacity=".22" />
          </svg>
        </div>
        <div className="min-w-0 relative z-10">
          <div className="inline-flex items-center gap-2 text-[10px] text-celadon-700 label-zh">
            模 型 市 集
          </div>
          <h1 className="mt-3 font-serif text-3xl font-semibold tracking-tight text-ink-900 sm:text-4xl md:text-5xl leading-tight">
            {heroName ? (
              <>
                <span>{greeting}，</span>
                <span className="brand-mark">{heroName}</span>
              </>
            ) : (
              <span className="brand-mark">万模 AI 工作台</span>
            )}
          </h1>
          <p className="mt-3 max-w-xl text-xs sm:text-sm text-ink-500 leading-relaxed">
            选择一个厂商开始对话，系统会自动使用该厂商的默认最新模型。或者前往
            <Link
              href="/image"
              className="mx-1 inline-flex items-center gap-1 text-celadon-700 font-semibold underline-offset-4 hover:text-celadon-500 hover:underline transition-colors"
            >
              图片工作台 <ArrowRight size={11} className="inline" />
            </Link>
            生成图片。
          </p>
        </div>

        {!isAuthenticated && (
          <Link
            href="/login?next=/chat"
            className="group inline-flex items-center gap-3 rounded-2xl border border-celadon-600/20 bg-celadon-50 px-4 py-3 transition-all hover:border-celadon-600/35"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-celadon-600 text-rice-50">
              <span className="font-serif font-semibold">万</span>
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-ink-900">登录解锁完整功能</p>
              <p className="mt-0.5 text-[10px] text-ink-500">
                微信扫码登录，同步 算力点余额
              </p>
            </div>
            <ArrowRight
              size={14}
              className="shrink-0 text-celadon-700 transition-transform group-hover:translate-x-0.5"
            />
          </Link>
        )}
      </div>

      {!showSkeleton && !showError && !showEmpty && (
        <div className="mb-7 flex gap-2 overflow-x-auto pb-1">
          {MARKET_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              type="button"
              className="chip-ink chip shrink-0 text-[11px] transition hover:border-celadon-600/20 hover:text-celadon-700"
            >
              {prompt}
            </button>
          ))}
        </div>
      )}

      <div className="mb-3 flex items-end justify-between">
        <div>
          <h2 className="font-serif text-base md:text-lg font-semibold text-ink-900">选择厂商</h2>
          <p className="mt-0.5 text-xs text-ink-500">
            {loadingModels && providers.length === 0
              ? '正在拉取模型列表...'
              : showError
                ? '模型列表加载失败'
                : showEmpty
                  ? '当前没有可用模型'
                  : `共 ${providers.length} 个厂商可用，每个厂商已自动选择默认模型`}
          </p>
        </div>
        {(showError || (!loadingModels && providers.length > 0)) && onRetry && (
          <button
            onClick={onRetry}
            className="inline-flex items-center gap-1.5 rounded-lg border border-ink-700/10 bg-rice-50 px-2.5 py-1.5 text-[11px] text-ink-600 transition hover:bg-rice-100 tap-transparent"
          >
            <RefreshCw size={12} /> 刷新
          </button>
        )}
      </div>

      {showSkeleton ? (
        <ProviderSkeleton />
      ) : showError ? (
        <ErrorPanel message={modelsError} onRetry={onRetry} />
      ) : showEmpty ? (
        <EmptyPanel isAuthenticated={isAuthenticated} />
      ) : (
        <div className="space-y-7">
          {domesticProviders.length > 0 && (
            <ProviderSection label="国 内 大 模 型" code="CN">
              <ProviderGrid
                providers={domesticProviders}
                onSelect={onSelectProvider}
                loading={loadingModels}
              />
            </ProviderSection>
          )}
          {globalProviders.length > 0 && (
            <ProviderSection label="海 外 大 模 型" code="GLOBAL">
              <ProviderGrid
                providers={globalProviders}
                onSelect={onSelectProvider}
                loading={loadingModels}
              />
            </ProviderSection>
          )}
        </div>
      )}
    </>
  )
}

function ProviderSection({ label, code, children }) {
  return (
    <section>
      <div className="mb-3 flex items-center gap-3">
        <span className="label-zh text-xs text-celadon-700">{label}</span>
        <div className="h-px flex-1 bg-ink-700/10" />
        <span className="font-mono text-[10px] text-ink-500">{code}</span>
      </div>
      {children}
    </section>
  )
}

function ProviderSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:gap-3 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-ink-700/10 bg-rice-50 p-3.5 sm:p-5">
          <div className="flex items-center justify-between">
            <div className="h-10 w-10 rounded-xl skeleton sm:h-11 sm:w-11" />
            <div className="h-4 w-8 rounded-full skeleton" />
          </div>
          <div className="mt-4 h-4 w-2/3 rounded skeleton" />
          <div className="mt-2 h-3 w-full rounded skeleton" />
          <div className="mt-3 h-3 w-1/2 rounded skeleton" />
        </div>
      ))}
    </div>
  )
}

function ErrorPanel({ message, onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-verm-500/25 bg-verm-500/10 px-5 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-verm-500/10">
        <AlertCircle className="text-verm-600" size={22} />
      </div>
      <div>
        <p className="text-sm font-medium text-verm-600">模型列表加载失败</p>
        <p className="mt-1 text-xs text-ink-500">{message || '请检查网络或稍后重试'}</p>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 rounded-xl bg-verm-500/10 px-3 py-2 text-xs font-medium text-verm-600 transition hover:bg-verm-500/15 tap-transparent"
        >
          <RefreshCw size={13} /> 重试
        </button>
      )}
    </div>
  )
}

function EmptyPanel({ isAuthenticated }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-ink-700/10 bg-rice-50 px-5 py-14 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rice-200">
        <Inbox className="text-ink-500" size={22} />
      </div>
      <div>
        <p className="text-sm font-medium text-ink-900">当前没有可用模型</p>
        <p className="mt-1 max-w-sm text-xs text-ink-500 leading-relaxed">
          {isAuthenticated
            ? '请联系管理员在后台启用至少一个模型'
            : '登录后可调用模型；若管理员还没启用任何模型，登录后也无法对话'}
        </p>
      </div>
    </div>
  )
}

export default ChatLanding
