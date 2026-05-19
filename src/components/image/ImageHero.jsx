'use client'

import Link from 'next/link'
import ImportExportBar from './ImportExportBar'

export function ImageHero({ isAuthenticated, isAuthLoading, taskCount }) {
  return (
    <>
      <div className="mb-4 flex flex-col gap-3 md:mb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white sm:text-3xl md:text-4xl">
            <span className="text-gradient-brand">文生图工作台</span>
          </h1>
          <p className="mt-1 max-w-xl text-xs text-slate-400 leading-relaxed sm:mt-2 sm:text-sm">
            支持文本生图与参考图编辑，{taskCount > 0 ? `已生成 ${taskCount} 个任务` : '所有任务保留在浏览器本地'}
          </p>
        </div>
        <div className="flex shrink-0">
          <ImportExportBar />
        </div>
      </div>

      {isAuthLoading && !isAuthenticated && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-slate-300 backdrop-blur-xl sm:gap-3 sm:rounded-2xl sm:px-4 sm:py-3 sm:text-sm">
          <span className="h-2 w-2 animate-pulse rounded-full bg-indigo-300" />
          <span className="flex-1 min-w-0">正在同步登录状态...</span>
        </div>
      )}

      {!isAuthLoading && !isAuthenticated && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-indigo-400/25 bg-indigo-500/10 px-3 py-2 text-xs text-indigo-100 backdrop-blur-xl sm:gap-3 sm:rounded-2xl sm:px-4 sm:py-3 sm:text-sm">
          <span className="flex-1 min-w-0">登录后才能调用图片生成模型并扣减算力点余额</span>
          <Link
            href="/login?next=/image"
            className="shrink-0 rounded-xl bg-indigo-500 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-indigo-400 tap-transparent"
          >
            微信扫码登录
          </Link>
        </div>
      )}
    </>
  )
}

export default ImageHero
