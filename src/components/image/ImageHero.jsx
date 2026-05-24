'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import ImportExportBar from './ImportExportBar'

export function ImageHero({ isAuthenticated, isAuthLoading, taskCount }) {
  return (
    <>
      <div className="relative mb-6 rounded-[28px] border border-ink-700/10 bg-rice-50 p-6 shadow-[var(--shadow-paper)] overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6 ricepaper">
        <div className="pointer-events-none absolute bottom-0 right-0 h-32 w-80 opacity-50">
          <svg viewBox="0 0 420 150" className="h-full w-full">
            <path d="M0 124 C70 56 130 96 184 58 C250 12 292 80 346 42 C380 18 404 26 420 34 V150 H0Z" fill="#A5CCC4" opacity=".58" />
            <path d="M0 136 C82 82 136 112 206 78 C270 48 306 94 364 64 C394 48 412 54 420 60 V150 H0Z" fill="#5BA5A0" opacity=".38" />
            <path d="M0 146 C92 102 158 124 222 92 C284 64 324 104 382 82 C402 74 414 78 420 82 V150 H0Z" fill="#1F6B66" opacity=".22" />
          </svg>
        </div>
        <div className="relative z-10 flex-1">
          <div className="text-[10px] text-celadon-700 label-zh">
            文 生 图
          </div>
          <h1 className="mt-3 font-serif text-3xl font-semibold tracking-tight text-ink-900 sm:text-4xl md:text-5xl leading-tight">
            <span className="brand-mark">文生图工作台</span>
          </h1>
          <p className="mt-2.5 max-w-xl text-xs sm:text-sm text-ink-500 leading-relaxed">
            支持文本生成图片、参考图智能融合。
            {taskCount > 0 ? (
              <span className="text-celadon-700"> 已在本地为您保留了 {taskCount} 个生成任务。</span>
            ) : (
              ' 激发艺术灵感，探索视觉设计的无限可能。'
            )}
          </p>
        </div>

        <div className="relative z-10 shrink-0 flex h-28 w-full items-center justify-center md:w-64">
          <div className="seal flex h-16 w-16 flex-col items-center justify-center text-center">
            <span className="font-serif text-base font-bold leading-tight">万模</span>
            <span className="mt-0.5 text-[10px] tracking-widest">画印</span>
          </div>
        </div>
      </div>

      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex shrink-0">
          <ImportExportBar />
        </div>
      </div>

      {isAuthLoading && !isAuthenticated && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-ink-700/10 bg-rice-50 px-4 py-3 text-xs text-ink-500 shadow-[var(--shadow-paper)]">
          <span className="h-1.5 w-1.5 animate-ping rounded-full bg-celadon-500" />
          <span className="flex-1 min-w-0 font-medium">正在同步您的云端身份与算力点余额...</span>
        </div>
      )}

      {!isAuthLoading && !isAuthenticated && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-celadon-600/20 bg-celadon-50 px-4 py-3 text-xs text-celadon-800">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-celadon-600" />
            <span className="font-medium">生成任务将扣减您的算力点，请先登录同步余额。</span>
          </div>
          <Link
            href="/login?next=/image"
            className="group shrink-0 inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-celadon-600 to-celadon-500 px-3.5 py-1.5 text-xs font-bold text-rice-50 shadow-[var(--shadow-ink)] transition-all duration-300 hover:scale-105 active:scale-95 tap-transparent"
          >
            微信扫码登录
            <ArrowRight size={12} className="transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      )}
    </>
  )
}

export default ImageHero
