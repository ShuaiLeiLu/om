'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Plus, X, Upload, ImagePlus } from 'lucide-react'
import { useImageStore } from '@/store/useImageStore'
import { sha256Hex } from '@/lib/image/hash'
import { putImage, getImageObjectUrl } from '@/lib/image/db'
import { getImageDimensions } from '@/lib/image/api'
import { useToast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'

const MAX_REFS = 16

export function ReferenceUploader() {
  const refs = useImageStore((s) => s.refs)
  const addRef = useImageStore((s) => s.addRef)
  const removeRef = useImageStore((s) => s.removeRef)
  const clearRefs = useImageStore((s) => s.clearRefs)
  const { toast } = useToast()
  const fileInputRef = useRef(null)
  const [isDragging, setIsDragging] = useState(false)
  const [processing, setProcessing] = useState(false)

  const ingestFiles = useCallback(
    async (files) => {
      if (!files || files.length === 0) return
      setProcessing(true)
      try {
        for (const file of files) {
          if (!file.type.startsWith('image/')) continue
          if (refs.length >= MAX_REFS) {
            toast({ variant: 'error', title: '参考图已达上限', description: '最多 16 张参考图' })
            break
          }
          const blob = file
          const hash = await sha256Hex(blob)
          if (refs.find((r) => r.hash === hash)) {
            toast({ variant: 'info', title: '已存在', description: '该参考图已经在列表中' })
            continue
          }
          let dim = { width: null, height: null }
          try {
            dim = await getImageDimensions(blob)
          } catch {}
          await putImage({ hash, blob, type: blob.type, width: dim.width, height: dim.height })
          const previewUrl = await getImageObjectUrl(hash)
          addRef({
            hash,
            previewUrl,
            type: blob.type,
            width: dim.width,
            height: dim.height,
            bytes: blob.size,
            name: file.name || `image_${hash.slice(0, 8)}`
          })
        }
      } catch (err) {
        toast({ variant: 'error', title: '导入失败', description: String(err?.message || err) })
      } finally {
        setProcessing(false)
      }
    },
    [refs, addRef, toast]
  )

  // global paste listener (only when this component is mounted on the page)
  useEffect(() => {
    const handler = async (e) => {
      const items = e.clipboardData?.items
      if (!items) return
      const files = []
      for (const it of items) {
        if (it.kind === 'file' && it.type.startsWith('image/')) {
          const f = it.getAsFile()
          if (f) files.push(f)
        }
      }
      if (files.length > 0) {
        e.preventDefault()
        await ingestFiles(files)
      }
    }
    window.addEventListener('paste', handler)
    return () => window.removeEventListener('paste', handler)
  }, [ingestFiles])

  const onDrop = useCallback(
    async (e) => {
      e.preventDefault()
      setIsDragging(false)
      const files = Array.from(e.dataTransfer?.files || [])
      await ingestFiles(files)
    },
    [ingestFiles]
  )

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        setIsDragging(true)
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={onDrop}
      className={cn(
        'rounded-xl border border-dashed transition-all',
        isDragging ? 'border-indigo-400/60 bg-indigo-500/10' : 'border-white/10 bg-white/[0.02]'
      )}
    >
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/5">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <ImagePlus size={14} />
          <span>参考图</span>
          <span className="chip">
            {refs.length} / {MAX_REFS}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {refs.length > 0 && (
            <button
              onClick={clearRefs}
              className="rounded-md px-2 py-1 text-[10px] text-slate-400 hover:bg-white/5 hover:text-white"
            >
              全部清除
            </button>
          )}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1 rounded-md bg-white/5 px-2 py-1 text-[11px] text-slate-200 hover:bg-white/10"
          >
            <Upload size={11} /> 上传
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => {
              ingestFiles(Array.from(e.target.files || []))
              e.target.value = ''
            }}
          />
        </div>
      </div>

      <div className="p-3">
        {refs.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-6 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 text-slate-400">
              <ImagePlus size={18} />
            </div>
            <p className="text-xs text-slate-400">拖拽 / 粘贴 / 点击上传图片</p>
            <p className="text-[10px] text-slate-600">最多 16 张，作为编辑参考</p>
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-4 xl:grid-cols-6">
            {refs.map((r) => (
              <RefThumb key={r.hash} item={r} onRemove={() => removeRef(r.hash)} />
            ))}
            {refs.length < MAX_REFS && (
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={processing}
                className="aspect-square rounded-lg border border-dashed border-white/15 bg-white/[0.02] text-slate-400 transition hover:border-white/30 hover:bg-white/[0.05] hover:text-white flex items-center justify-center"
              >
                <Plus size={18} />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function RefThumb({ item, onRemove }) {
  return (
    <div className="group relative aspect-square overflow-hidden rounded-lg border border-white/10 bg-white/5">
      <img src={item.previewUrl} alt="" className="h-full w-full object-cover" />
      <button
        onClick={onRemove}
        className="absolute right-1 top-1 hidden h-5 w-5 items-center justify-center rounded-full bg-black/70 text-white opacity-0 transition-opacity group-hover:flex group-hover:opacity-100"
      >
        <X size={10} />
      </button>
      <div className="absolute inset-x-0 bottom-0 hidden bg-gradient-to-t from-black/80 to-transparent px-1 py-0.5 text-[9px] text-white/90 group-hover:block">
        {item.width && item.height ? `${item.width}×${item.height}` : '?'}
      </div>
    </div>
  )
}

export default ReferenceUploader
