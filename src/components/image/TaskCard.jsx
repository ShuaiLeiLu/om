'use client'

import { memo, useEffect, useState } from 'react'
import { Loader2, AlertCircle, Image as ImageIcon, Clock } from 'lucide-react'
import { getTask } from '@/lib/image/db'
import { getImageObjectUrl } from '@/lib/image/db'
import { cn, formatRelativeTime } from '@/lib/utils'
import { describeSize } from '@/lib/image/size'

function TaskCardImpl({ taskId, taskStatus, onClick }) {
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
      <div className="card-glass aspect-square animate-pulse">
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
        'group relative overflow-hidden rounded-2xl border bg-slate-900/35 backdrop-blur-xl text-left transition-all duration-300',
        'border-white/5 hover:border-white/12 hover:bg-slate-950/60 hover:shadow-[0_8px_24px_rgba(99,102,241,0.08)] active:scale-[0.98]',
        isFailed && 'border-rose-500/20'
      )}
    >
      <div className="relative aspect-square w-full overflow-hidden bg-slate-950">
        {isRunning ? (
          <div className="relative flex h-full w-full flex-col items-center justify-center bg-slate-900/60 p-4 overflow-hidden border border-white/5">
            {/* Light shine scanner animation */}
            <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-transparent via-indigo-500 to-transparent blur-[1px]" style={{
              animation: 'scan 2.5s cubic-bezier(0.4, 0, 0.2, 1) infinite',
            }} />
            <style>{`
              @keyframes scan {
                0% { top: 0%; opacity: 0; }
                10% { opacity: 1; }
                90% { opacity: 1; }
                100% { top: 100%; opacity: 0; }
              }
            `}</style>
            <Loader2 className="text-indigo-400 animate-spin mb-2" size={24} />
            <span className="text-[10px] text-indigo-300 font-semibold tracking-wider uppercase animate-pulse">正在生成</span>
            <span className="text-[9px] text-slate-500 font-mono mt-1 max-w-full truncate">{task.modelName || 'Image Gen'}</span>
          </div>
        ) : isFailed ? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-rose-500/10 p-4 text-center">
            <AlertCircle className="text-rose-400" size={22} />
            <p className="text-[10.5px] font-semibold text-rose-300">生成失败</p>
          </div>
        ) : isLoadingThumbs && task.outputs?.length > 0 ? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-slate-900/40 text-slate-400">
            <Loader2 className="animate-spin text-indigo-400" size={20} />
            <p className="text-[10px]">载入中</p>
          </div>
        ) : thumbs.length > 0 ? (
          <>
            <div
              className={cn(
                'grid h-full w-full gap-px bg-black/40 transition-transform duration-500 group-hover:scale-[1.03]',
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
                  className="h-full w-full object-cover"
                />
              ))}
            </div>

            {/* Hover specs overlay info bar */}
            <div className="absolute inset-x-0 bottom-0 z-10 translate-y-full transition-transform duration-300 group-hover:translate-y-0 bg-slate-950/80 border-t border-white/5 p-2 backdrop-blur-md flex items-center justify-between gap-2 pointer-events-none">
              <div className="min-w-0">
                <span className="block text-[9px] font-mono text-slate-200 truncate">{sizeText}</span>
                <span className="block text-[8px] text-slate-400">
                  {task.durationMs ? `${(task.durationMs / 1000).toFixed(1)}s` : '生图完成'}
                </span>
              </div>
              {task.modelName && (
                <span className="shrink-0 rounded bg-white/5 border border-white/8 px-1.5 py-0.5 text-[8px] font-semibold text-indigo-300 max-w-[80px] truncate">
                  {task.modelName}
                </span>
              )}
            </div>
          </>
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-white/5 text-slate-600">
            <ImageIcon size={24} />
          </div>
        )}

        {!isRunning && !isFailed && task.outputs?.length > 4 && (
          <div className="absolute right-2 top-2 rounded-full bg-slate-950/85 border border-white/5 px-2 py-0.5 text-[9px] font-semibold text-slate-200 backdrop-blur">
            +{task.outputs.length - 4}
          </div>
        )}
        {task.refs?.length > 0 && (
          <div className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-slate-950/85 border border-white/5 px-2 py-0.5 text-[9px] font-semibold text-slate-200 backdrop-blur">
            <ImageIcon size={10} className="text-indigo-400" />
            {task.refs.length}
          </div>
        )}
      </div>

      <div className="p-3 space-y-1">
        <p className="line-clamp-2 text-xs text-slate-200 leading-relaxed font-medium">{task.prompt}</p>
        <div className="flex items-center justify-between text-[10px] text-slate-500 font-medium pt-1">
          <span>{task.outputs?.length || 0} 张图片</span>
          <span className="flex items-center gap-1">
            <Clock size={9} />
            {formatRelativeTime(task.createdAt)}
          </span>
        </div>
      </div>
    </button>
  )
}

export const TaskCard = memo(TaskCardImpl, (prev, next) => (
  prev.taskId === next.taskId &&
  prev.taskStatus === next.taskStatus &&
  prev.onClick === next.onClick
))

export default TaskCard
