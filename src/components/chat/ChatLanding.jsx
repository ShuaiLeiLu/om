'use client'

import Link from 'next/link'
import { Sparkles, ArrowRight, AlertCircle, RefreshCw, Inbox } from 'lucide-react'
import { getGreeting } from '@/lib/model-badges'
import ProviderGrid from './ProviderGrid'

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

  return (
    <>
      <div className="mb-7 flex flex-col gap-5 md:mb-8 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-slate-500 md:text-[11px]">
            <Sparkles size={11} className="text-indigo-300" />
            Chat Workspace
          </div>
          <h1 className="mt-1.5 text-3xl font-bold tracking-tight text-white sm:text-4xl md:text-5xl">
            {heroName ? (
              <>
                <span className="text-slate-300">{greeting}，</span>
                <span className="text-gradient-brand">{heroName}</span>
              </>
            ) : (
              <span className="text-gradient-brand">万模 AI</span>
            )}
          </h1>
          <p className="mt-2.5 max-w-xl text-sm text-slate-400 leading-relaxed">
            选择一个厂商开始对话，系统会自动使用该厂商的默认最新模型。或者前往
            <Link
              href="/image"
              className="mx-1 inline-flex items-center gap-1 text-fuchsia-300 underline-offset-2 hover:text-fuchsia-200 hover:underline"
            >
              图片工作台 <ArrowRight size={11} />
            </Link>
            生成图片。
          </p>
        </div>

        {!isAuthenticated && (
          <Link
            href="/login"
            className="group inline-flex items-center gap-3 rounded-2xl border border-indigo-400/30 bg-gradient-to-br from-indigo-500/15 to-fuchsia-500/10 px-4 py-3 backdrop-blur-xl transition-all hover:border-indigo-400/50 hover:from-indigo-500/25 hover:to-fuchsia-500/15"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-400 to-fuchsia-400">
              <Sparkles size={15} className="text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-100">登录解锁完整功能</p>
              <p className="mt-0.5 text-[10px] text-slate-400">
                微信扫码登录，同步 Token 余额
              </p>
            </div>
            <ArrowRight
              size={14}
              className="shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5"
            />
          </Link>
        )}
      </div>

      <div className="mb-3 flex items-end justify-between">
        <div>
          <h2 className="text-base md:text-lg font-semibold text-white">选择厂商</h2>
          <p className="mt-0.5 text-xs text-slate-500">
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
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-[11px] text-slate-300 transition hover:bg-white/10 tap-transparent"
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
        <ProviderGrid
          providers={providers}
          onSelect={onSelectProvider}
          loading={loadingModels}
        />
      )}
    </>
  )
}

function ProviderSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:gap-3 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl border border-white/8 bg-white/[0.03] p-3.5 sm:p-5 backdrop-blur-xl"
        >
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
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-rose-400/25 bg-rose-500/10 px-5 py-12 text-center backdrop-blur-xl">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500/15">
        <AlertCircle className="text-rose-300" size={22} />
      </div>
      <div>
        <p className="text-sm font-medium text-rose-100">模型列表加载失败</p>
        <p className="mt-1 text-xs text-rose-200/70">{message || '请检查网络或稍后重试'}</p>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 rounded-xl bg-rose-500/20 px-3 py-2 text-xs font-medium text-rose-100 transition hover:bg-rose-500/30 tap-transparent"
        >
          <RefreshCw size={13} /> 重试
        </button>
      )}
    </div>
  )
}

function EmptyPanel({ isAuthenticated }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-white/8 bg-white/[0.03] px-5 py-14 text-center backdrop-blur-xl">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5">
        <Inbox className="text-slate-400" size={22} />
      </div>
      <div>
        <p className="text-sm font-medium text-slate-200">当前没有可用模型</p>
        <p className="mt-1 max-w-sm text-xs text-slate-400 leading-relaxed">
          {isAuthenticated
            ? '请联系管理员在后台启用至少一个模型'
            : '登录后可调用模型；若管理员还没启用任何模型，登录后也无法对话'}
        </p>
      </div>
    </div>
  )
}

export default ChatLanding
