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
        'group relative overflow-hidden rounded-2xl border bg-rice-50 text-left shadow-[var(--shadow-paper)] transition-all duration-300',
        'border-ink-700/10 hover:border-celadon-200 hover:shadow-[var(--shadow-paper-lg)] active:scale-[0.98]',
        isFailed && 'border-verm-500/25'
      )}
    >
      <div className="relative aspect-square w-full overflow-hidden bg-rice-200">
        {isRunning ? (
          <div className="relative flex h-full w-full flex-col items-center justify-center bg-celadon-50 p-4 overflow-hidden border border-celadon-600/10">
            <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-transparent via-celadon-500 to-transparent" style={{
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
            <Loader2 className="text-celadon-600 animate-spin mb-2" size={24} />
            <span className="text-[10px] text-celadon-700 font-semibold tracking-wider animate-pulse">正在生成</span>
            <span className="text-[9px] text-ink-500 font-mono mt-1 max-w-full truncate">{task.modelName || 'Image Gen'}</span>
          </div>
        ) : isFailed ? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-verm-500/10 p-4 text-center">
            <AlertCircle className="text-verm-600" size={22} />
            <p className="text-[10.5px] font-semibold text-verm-600">生成失败</p>
          </div>
        ) : isLoadingThumbs && task.outputs?.length > 0 ? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-rice-100 text-ink-500">
            <Loader2 className="animate-spin text-celadon-600" size={20} />
            <p className="text-[10px]">载入中</p>
          </div>
        ) : thumbs.length > 0 ? (
          <>
            <div
              className={cn(
                'grid h-full w-full gap-px bg-rice-200 transition-transform duration-500 group-hover:scale-[1.03]',
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
            <div className="absolute inset-x-0 bottom-0 z-10 translate-y-full transition-transform duration-300 group-hover:translate-y-0 bg-rice-50/92 border-t border-ink-700/10 p-2 backdrop-blur-md flex items-center justify-between gap-2 pointer-events-none">
              <div className="min-w-0">
                <span className="block text-[9px] font-mono text-ink-700 truncate">{sizeText}</span>
                <span className="block text-[8px] text-ink-500">
                  {task.durationMs ? `${(task.durationMs / 1000).toFixed(1)}s` : '生图完成'}
                </span>
              </div>
              {task.modelName && (
                <span className="shrink-0 rounded bg-celadon-50 border border-celadon-600/15 px-1.5 py-0.5 text-[8px] font-semibold text-celadon-700 max-w-[80px] truncate">
                  {task.modelName}
                </span>
              )}
            </div>
          </>
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-rice-100 text-ink-400">
            <ImageIcon size={24} />
          </div>
        )}

        {!isRunning && !isFailed && task.outputs?.length > 4 && (
          <div className="absolute right-2 top-2 rounded-full bg-rice-50/90 border border-ink-700/10 px-2 py-0.5 text-[9px] font-semibold text-ink-700 backdrop-blur">
            +{task.outputs.length - 4}
          </div>
        )}
        {task.refs?.length > 0 && (
          <div className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-rice-50/90 border border-ink-700/10 px-2 py-0.5 text-[9px] font-semibold text-ink-700 backdrop-blur">
            <ImageIcon size={10} className="text-celadon-600" />
            {task.refs.length}
          </div>
        )}
      </div>

      <div className="p-3 space-y-1">
        <p className="line-clamp-2 text-xs text-ink-700 leading-relaxed font-medium">{task.prompt}</p>
        <div className="flex items-center justify-between text-[10px] text-ink-500 font-medium pt-1">
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
