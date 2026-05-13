'use client'

import Link from 'next/link'
import { Sparkles } from 'lucide-react'
import ImportExportBar from './ImportExportBar'

export function ImageHero({ isAuthenticated, taskCount }) {
  return (
    <>
      <div className="mb-5 flex flex-col gap-4 md:mb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-slate-500 md:text-[11px]">
            <Sparkles size={11} className="text-fuchsia-300" />
            Image Workspace
          </div>
          <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-white sm:text-3xl md:text-4xl">
            <span className="text-gradient-brand">文生图工作台</span>
          </h1>
          <p className="mt-2 max-w-xl text-xs text-slate-400 leading-relaxed sm:text-sm">
            支持文本生图与参考图编辑，{taskCount > 0 ? `已生成 ${taskCount} 个任务` : '所有任务保留在浏览器本地'}
          </p>
        </div>
        <div className="flex shrink-0">
          <ImportExportBar />
        </div>
      </div>

      {!isAuthenticated && (
        <div className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-indigo-400/25 bg-indigo-500/10 px-3 py-2.5 text-xs text-indigo-100 backdrop-blur-xl sm:px-4 sm:py-3 sm:text-sm">
          <span className="flex-1 min-w-0">登录后才能调用图片生成模型并扣减 Token 余额</span>
          <Link
            href="/login"
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
