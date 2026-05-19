'use client'

import { useEffect, useState } from 'react'
import { Loader2, AlertCircle, Image as ImageIcon, Clock } from 'lucide-react'
import { getTask } from '@/lib/image/db'
import { getImageObjectUrl } from '@/lib/image/db'
import { cn, formatRelativeTime } from '@/lib/utils'
import { describeSize } from '@/lib/image/size'

export function TaskCard({ taskId, taskStatus, onClick }) {
  const [task, setTask] = useState(null)
  const [thumbs, setThumbs] = useState([])
  const [isLoadingThumbs, setIsLoadingThumbs] = useState(false)

  useEffect(() => {
    let revoke = []
    let cancelled = false
    ;(async () => {
      setIsLoadingThumbs(true)
      const t = await getTask(taskId)
      if (!t || cancelled) {
        if (!cancelled) setIsLoadingThumbs(false)
        return
      }
      setTask(t)
      const outs = (t.outputs || []).slice(0, 4)
      const urls = []
      for (const h of outs) {
        const url = await getImageObjectUrl(h)
        if (url) urls.push(url)
      }
      if (cancelled) {
        urls.forEach((u) => URL.revokeObjectURL(u))
        return
      }
      revoke = urls
      setThumbs(urls)
      setIsLoadingThumbs(false)
    })()
    return () => {
      cancelled = true
      revoke.forEach((u) => URL.revokeObjectURL(u))
    }
  }, [taskId, taskStatus])

  if (!task) {
    return (
      <div className="card-glass aspect-[3/4] animate-pulse">
        <div className="h-full w-full rounded-xl skeleton" />
      </div>
    )
  }

  const isRunning = task.status === 'running' || task.status === 'pending'
  const isFailed = task.status === 'failed'
  const sizeText = describeSize(task.params?.size)

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group relative overflow-hidden rounded-xl border bg-white/[0.04] backdrop-blur-xl text-left transition-all sm:rounded-2xl',
        'border-white/8 hover:border-white/20 hover:bg-white/[0.06] active:scale-[0.98]',
        isFailed && 'border-rose-400/20'
      )}
    >
      <div className="relative aspect-square w-full overflow-hidden">
        {isRunning ? (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-indigo-500/20 to-purple-500/20">
            <Loader2 className="text-white animate-spin" size={28} />
          </div>
        ) : isFailed ? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-rose-500/10 p-4 text-center">
            <AlertCircle className="text-rose-300" size={22} />
            <p className="text-[10px] text-rose-200">生成失败</p>
          </div>
        ) : isLoadingThumbs && task.outputs?.length > 0 ? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 text-slate-300">
            <Loader2 className="animate-spin" size={22} />
            <p className="text-[10px]">载入图片</p>
          </div>
        ) : thumbs.length > 0 ? (
          <div
            className={cn(
              'grid h-full w-full gap-px bg-black/40',
              thumbs.length === 1 && 'grid-cols-1',
              thumbs.length === 2 && 'grid-cols-2',
              thumbs.length >= 3 && 'grid-cols-2 grid-rows-2'
            )}
          >
            {thumbs.map((src, i) => (
              <img
                key={i}
                src={src}
                alt=""
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
            ))}
          </div>
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-white/5 text-slate-500">
            <ImageIcon size={28} />
          </div>
        )}

        {!isRunning && !isFailed && task.outputs?.length > 4 && (
          <div className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] text-white backdrop-blur">
            +{task.outputs.length - 4}
          </div>
        )}
        {task.refs?.length > 0 && (
          <div className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[10px] text-white backdrop-blur">
            <ImageIcon size={10} />
            {task.refs.length}
          </div>
        )}
      </div>

      <div className="p-2 space-y-0.5 sm:p-3 sm:space-y-1">
        <p className="line-clamp-2 text-[11px] text-slate-200 leading-relaxed sm:text-xs">{task.prompt}</p>
        <div className="flex items-center justify-between text-[9px] text-slate-500 sm:text-[10px]">
          <span>{sizeText}</span>
          <span className="flex items-center gap-1">
            <Clock size={8} />
            {formatRelativeTime(task.createdAt)}
          </span>
        </div>
      </div>
    </button>
  )
}

export default TaskCard
