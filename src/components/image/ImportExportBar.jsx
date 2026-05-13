'use client'

import { useRef, useState } from 'react'
import { Upload, Download, Loader2, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { exportAllTasksToZip, importTasksFromZip } from '@/lib/image/zip'
import { listTasks, clearAllTasks, cleanOrphanImages } from '@/lib/image/db'
import { useImageStore } from '@/store/useImageStore'
import { downloadBlob } from '@/lib/utils'

export function ImportExportBar() {
  const setTaskIndex = useImageStore((s) => s.setTaskIndex)
  const fileInputRef = useRef(null)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(null)
  const { toast } = useToast()

  const handleExport = async () => {
    setBusy(true)
    try {
      const blob = await exportAllTasksToZip()
      const date = new Date().toISOString().slice(0, 10)
      downloadBlob(blob, `chatty-image-export-${date}.zip`)
      toast({ variant: 'success', title: '已导出', description: '包含原始图片与 manifest.json' })
    } catch (err) {
      toast({ variant: 'error', title: '导出失败', description: String(err?.message || err) })
    } finally {
      setBusy(false)
    }
  }

  const handleImport = async (file) => {
    if (!file) return
    setBusy(true)
    setProgress({ phase: 'images', current: 0, total: 0 })
    try {
      const result = await importTasksFromZip(file, { onProgress: setProgress })
      const tasks = await listTasks()
      setTaskIndex(tasks)
      toast({
        variant: 'success',
        title: '导入完成',
        description: `${result.taskImported} 个任务 / ${result.imageImported} 张图（${result.imageSkipped} 张去重）`
      })
    } catch (err) {
      toast({ variant: 'error', title: '导入失败', description: String(err?.message || err) })
    } finally {
      setBusy(false)
      setProgress(null)
    }
  }

  const handleClearAll = async () => {
    if (!confirm('确认清空全部任务和图片？此操作不可恢复。')) return
    setBusy(true)
    try {
      await clearAllTasks()
      await cleanOrphanImages()
      setTaskIndex([])
      toast({ variant: 'success', title: '已清空' })
    } catch (err) {
      toast({ variant: 'error', title: '清空失败', description: String(err?.message || err) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant="glass"
        size="sm"
        onClick={() => fileInputRef.current?.click()}
        disabled={busy}
      >
        {busy && progress?.phase === 'images' ? (
          <Loader2 size={13} className="animate-spin" />
        ) : (
          <Upload size={13} />
        )}
        导入 ZIP
      </Button>
      <Button variant="glass" size="sm" onClick={handleExport} disabled={busy}>
        {busy && !progress ? (
          <Loader2 size={13} className="animate-spin" />
        ) : (
          <Download size={13} />
        )}
        导出 ZIP
      </Button>
      <Button variant="ghost" size="sm" onClick={handleClearAll} disabled={busy}>
        <Trash2 size={13} /> 清空
      </Button>
      {progress && (
        <span className="text-[10px] text-slate-400">
          {progress.phase === 'images' ? '导入图片' : '导入任务'}{' '}
          {progress.current} / {progress.total}
        </span>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".zip,application/zip"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) handleImport(f)
          e.target.value = ''
        }}
      />
    </div>
  )
}

export default ImportExportBar
