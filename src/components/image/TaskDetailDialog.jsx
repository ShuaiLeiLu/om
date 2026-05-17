'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Download,
  Copy,
  RefreshCw,
  Repeat,
  Trash2,
  ImagePlus,
  Loader2,
  AlertCircle
} from 'lucide-react'
import { Dialog, DialogHeader, DialogBody, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useImageStore } from '@/store/useImageStore'
import { getTask, getImageObjectUrl, deleteTask, getImage } from '@/lib/image/db'
import { useToast } from '@/components/ui/toast'
import { downloadBlob, formatRelativeTime, formatBytes } from '@/lib/utils'
import { describeSize } from '@/lib/image/size'

export function TaskDetailDialog({ taskId, onClose }) {
  const [task, setTask] = useState(null)
  const [outputUrls, setOutputUrls] = useState([])
  const [refUrls, setRefUrls] = useState([])
  const [activeIdx, setActiveIdx] = useState(0)
  const { toast } = useToast()

  const removeTaskFromIndex = useImageStore((s) => s.removeTaskFromIndex)
  const reuseTaskConfig = useImageStore((s) => s.reuseTaskConfig)
  const addRef = useImageStore((s) => s.addRef)

  useEffect(() => {
    if (!taskId) {
      setTask(null)
      setOutputUrls([])
      setRefUrls([])
      return
    }
    let revoke = []
    let cancelled = false
    ;(async () => {
      const t = await getTask(taskId)
      if (!t || cancelled) return
      setTask(t)
      const outs = []
      for (const h of t.outputs || []) {
        const url = await getImageObjectUrl(h)
        if (url) outs.push({ hash: h, url })
      }
      const refs = []
      for (const h of t.refs || []) {
        const url = await getImageObjectUrl(h)
        if (url) refs.push({ hash: h, url })
      }
      if (cancelled) {
        ;[...outs, ...refs].forEach((x) => URL.revokeObjectURL(x.url))
        return
      }
      revoke = [...outs, ...refs]
      setOutputUrls(outs)
      setRefUrls(refs)
      setActiveIdx(0)
    })()
    return () => {
      cancelled = true
      revoke.forEach((x) => URL.revokeObjectURL(x.url))
    }
  }, [taskId])

  const handleDownload = useCallback(async () => {
    const item = outputUrls[activeIdx]
    if (!item) return
    const rec = await getImage(item.hash)
    if (!rec) return
    const ext = (rec.type || 'image/png').split('/')[1] || 'png'
    downloadBlob(rec.blob, `image_${item.hash.slice(0, 10)}.${ext}`)
    toast({ variant: 'success', title: '已开始下载' })
  }, [outputUrls, activeIdx, toast])

  const handleCopy = useCallback(async () => {
    const item = outputUrls[activeIdx]
    if (!item) return
    try {
      const rec = await getImage(item.hash)
      if (!rec) return
      if (navigator.clipboard?.write) {
        await navigator.clipboard.write([new ClipboardItem({ [rec.type || 'image/png']: rec.blob })])
        toast({ variant: 'success', title: '已复制图片' })
      } else {
        throw new Error('剪贴板 API 不可用')
      }
    } catch (err) {
      toast({ variant: 'error', title: '复制失败', description: String(err?.message || err) })
    }
  }, [outputUrls, activeIdx, toast])

  const handleAddAsRef = useCallback(async () => {
    const item = outputUrls[activeIdx]
    if (!item) return
    const rec = await getImage(item.hash)
    if (!rec) return
    addRef({
      hash: item.hash,
      previewUrl: item.url,
      type: rec.type,
      width: rec.width,
      height: rec.height,
      bytes: rec.bytes,
      name: `output_${item.hash.slice(0, 8)}`
    })
    toast({ variant: 'success', title: '已添加到参考图', description: '可在下一轮迭代中使用' })
    onClose?.()
  }, [outputUrls, activeIdx, addRef, toast, onClose])

  const handleReuse = useCallback(() => {
    if (!task) return
    reuseTaskConfig({
      prompt: task.prompt,
      params: task.params,
      sizePreset: task.sizePreset
    })
    toast({ variant: 'success', title: '已回填配置' })
    onClose?.()
  }, [task, reuseTaskConfig, toast, onClose])

  const handleDelete = useCallback(async () => {
    if (!task) return
    if (!confirm('确认删除这条任务？图片和元数据会被清除（其他任务引用的图片会保留）。')) return
    await deleteTask(task.id)
    removeTaskFromIndex(task.id)
    toast({ variant: 'success', title: '已删除' })
    onClose?.()
  }, [task, removeTaskFromIndex, toast, onClose])

  if (!taskId) return null

  return (
    <Dialog open={!!taskId} onClose={onClose} size="xl">
      <DialogHeader title="任务详情" onClose={onClose}>
        {task && (
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
            <span className="chip">{describeSize(task.params?.size)}</span>
            <span className="chip">质量 {task.params?.quality}</span>
            <span className="chip">{(task.params?.output_format || 'png').toUpperCase()}</span>
            {task.params?.n > 1 && <span className="chip">×{task.params.n}</span>}
            <span className="chip">{formatRelativeTime(task.createdAt)}</span>
            {task.durationMs && <span className="chip">耗时 {(task.durationMs / 1000).toFixed(1)} s</span>}
          </div>
        )}
      </DialogHeader>

      <DialogBody className="max-h-[70vh] overflow-y-auto scrollbar-thin">
        {!task ? (
          <div className="flex h-40 items-center justify-center text-slate-400">
            <Loader2 className="animate-spin" />
          </div>
        ) : (
          <div className="space-y-5">
            {task.error && (
              <div className="flex items-start gap-2 rounded-xl border border-rose-400/30 bg-rose-500/10 p-3 text-xs text-rose-200">
                <AlertCircle size={14} className="mt-0.5 shrink-0" />
                <span className="flex-1">{task.error}</span>
              </div>
            )}

            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">提示词</p>
              <div className="rounded-xl border border-white/8 bg-white/[0.03] p-3 text-sm text-slate-200 leading-relaxed">
                {task.prompt}
              </div>
            </div>

            {outputUrls.length > 0 && (
              <div>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  生成结果 ({outputUrls.length})
                </p>
                <div className="rounded-xl border border-white/8 bg-black/30 overflow-hidden">
                  <div className="relative aspect-square w-full max-h-[55vh] flex items-center justify-center">
                    <img
                      src={outputUrls[activeIdx]?.url}
                      alt=""
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>
                  {outputUrls.length > 1 && (
                    <div className="flex gap-2 overflow-x-auto border-t border-white/5 bg-white/[0.02] p-2 scrollbar-thin">
                      {outputUrls.map((o, i) => (
                        <button
                          key={o.hash}
                          onClick={() => setActiveIdx(i)}
                          className={
                            i === activeIdx
                              ? 'h-14 w-14 shrink-0 overflow-hidden rounded-md border-2 border-indigo-400'
                              : 'h-14 w-14 shrink-0 overflow-hidden rounded-md border border-white/10 opacity-60 hover:opacity-100'
                          }
                        >
                          <img src={o.url} alt="" className="h-full w-full object-cover" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {refUrls.length > 0 && (
              <div>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  参考图 ({refUrls.length})
                </p>
                <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8">
                  {refUrls.map((r) => (
                    <div
                      key={r.hash}
                      className="aspect-square overflow-hidden rounded-lg border border-white/10 bg-white/5"
                    >
                      <img src={r.url} alt="" className="h-full w-full object-cover" />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </DialogBody>

      <DialogFooter className="flex-wrap justify-between gap-2">
        <Button variant="danger" size="sm" onClick={handleDelete}>
          <Trash2 size={14} /> 删除
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          {outputUrls.length > 0 && (
            <>
              <Button variant="glass" size="sm" onClick={handleCopy}>
                <Copy size={14} /> 复制
              </Button>
              <Button variant="glass" size="sm" onClick={handleDownload}>
                <Download size={14} /> 下载
              </Button>
              <Button variant="glass" size="sm" onClick={handleAddAsRef}>
                <ImagePlus size={14} /> 作为参考图
              </Button>
            </>
          )}
          <Button variant="gradient" size="sm" onClick={handleReuse}>
            <RefreshCw size={14} /> 复用配置
          </Button>
        </div>
      </DialogFooter>
    </Dialog>
  )
}

export default TaskDetailDialog
