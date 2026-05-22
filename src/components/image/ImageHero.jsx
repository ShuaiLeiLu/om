'use client'

import Link from 'next/link'
import { Sparkles, ArrowRight, Image as ImageIcon } from 'lucide-react'
import ImportExportBar from './ImportExportBar'

export function ImageHero({ isAuthenticated, isAuthLoading, taskCount }) {
  return (
    <>
      <div className="relative mb-6 rounded-3xl border border-white/5 bg-slate-900/15 p-6 backdrop-blur-md overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6">
        {/* Glow decoration */}
        <div className="absolute -right-8 -top-8 h-48 w-48 bg-fuchsia-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -left-12 -bottom-12 h-40 w-40 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex-1">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-fuchsia-500/25 bg-fuchsia-500/10 px-2.5 py-0.5 text-[9px] uppercase tracking-widest text-fuchsia-300 font-bold">
            <Sparkles size={10} className="text-fuchsia-300 animate-pulse" />
            Creative Studio
          </div>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl md:text-5xl leading-tight">
            <span className="text-gradient-brand text-glow-purple">文生图工作台</span>
          </h1>
          <p className="mt-2.5 max-w-xl text-xs sm:text-sm text-slate-400 leading-relaxed font-medium">
            支持文本生成图片、参考图智能融合。
            {taskCount > 0 ? (
              <span className="text-indigo-300"> 已在本地为您保留了 {taskCount} 个生成任务。</span>
            ) : (
              ' 激发艺术灵感，探索视觉设计的无限可能。'
            )}
          </p>
        </div>

        {/* Decorative Collage Box */}
        <div className="relative shrink-0 flex items-center justify-center gap-3 overflow-hidden h-28 w-full md:w-80 rounded-2xl border border-white/5 bg-white/[0.01] p-2 self-stretch md:self-auto select-none pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950/20 via-transparent to-slate-950/20 z-10" />
          <div className="flex gap-3">
            <div className="h-20 w-20 shrink-0 rounded-xl bg-gradient-to-br from-amber-500/20 to-rose-500/30 border border-white/8 rotate-3 shadow-lg flex flex-col items-center justify-center p-1.5 transition-transform duration-500 hover:rotate-6">
              <ImageIcon size={14} className="text-amber-300/40 mb-1" />
              <span className="text-[8px] text-amber-200/50 font-mono">Abstract</span>
            </div>
            <div className="h-20 w-20 shrink-0 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/30 border border-white/8 -rotate-3 shadow-lg flex flex-col items-center justify-center p-1.5 transition-transform duration-500 hover:-rotate-6">
              <ImageIcon size={14} className="text-purple-300/40 mb-1" />
              <span className="text-[8px] text-purple-200/50 font-mono">Cyberpunk</span>
            </div>
            <div className="h-20 w-20 shrink-0 rounded-xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/30 border border-white/8 rotate-6 shadow-lg flex flex-col items-center justify-center p-1.5 transition-transform duration-500 hover:rotate-12">
              <ImageIcon size={14} className="text-cyan-300/40 mb-1" />
              <span className="text-[8px] text-cyan-200/50 font-mono">Surrealism</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex shrink-0">
          <ImportExportBar />
        </div>
      </div>

      {isAuthLoading && !isAuthenticated && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-white/5 bg-white/[0.02] px-4 py-3 text-xs text-slate-400 backdrop-blur-xl">
          <span className="h-1.5 w-1.5 animate-ping rounded-full bg-indigo-400" />
          <span className="flex-1 min-w-0 font-medium">正在同步您的云端身份与算力点余额...</span>
        </div>
      )}

      {!isAuthLoading && !isAuthenticated && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-indigo-500/25 bg-gradient-to-r from-indigo-500/10 to-fuchsia-500/5 px-4 py-3 text-xs text-indigo-200 backdrop-blur-xl">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-indigo-400 shadow-[0_0_8px_rgba(99,102,241,0.6)]" />
            <span className="font-medium">生成任务将扣减您的算力点，请先登录同步余额。</span>
          </div>
          <Link
            href="/login?next=/image"
            className="group shrink-0 inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-lg transition-all duration-300 hover:scale-105 active:scale-95 tap-transparent"
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
