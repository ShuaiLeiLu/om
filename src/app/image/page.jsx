'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { SlidersHorizontal, Wand2 } from 'lucide-react'
import Shell from '@/components/layout/Shell'
import { useAuthStore } from '@/store/useStore'
import { useImageStore, newTaskId } from '@/store/useImageStore'
import { fetchModels, fetchMe, fetchQuotaSummary } from '@/lib/api'
import { decorateProvider, fallbackProviders } from '@/lib/config'
import { isImageGenerationModel } from '@/lib/model-badges'
import { describeSize } from '@/lib/image/size'
import {
  listTasks,
  upsertTask,
  cleanOrphanImages,
  putImage,
  getImage
} from '@/lib/image/db'
import { sha256Hex } from '@/lib/image/hash'
import {
  generateImageRequest,
  editImageRequest,
  urlToBlob,
  getImageDimensions,
  blobToDataUrl
} from '@/lib/image/api'
import { ToastProvider, useToast } from '@/components/ui/toast'
import ImageHero from '@/components/image/ImageHero'
import PromptComposer from '@/components/image/PromptComposer'
import ParamsPanel from '@/components/image/ParamsPanel'
import ParamsDrawer from '@/components/image/ParamsDrawer'
import ReferenceUploader from '@/components/image/ReferenceUploader'
import TaskGallery from '@/components/image/TaskGallery'
import TaskDetailDialog from '@/components/image/TaskDetailDialog'

function ImagePageInner() {
  const router = useRouter()
  const { isAuthenticated, setAuthLoading, setSession, clearSession } = useAuthStore()
  const { toast } = useToast()

  const taskIndex = useImageStore((s) => s.taskIndex)
  const setTaskIndex = useImageStore((s) => s.setTaskIndex)
  const addTaskToIndex = useImageStore((s) => s.addTaskToIndex)
  const updateTaskInIndex = useImageStore((s) => s.updateTaskInIndex)
  const modelId = useImageStore((s) => s.modelId)
  const setModelId = useImageStore((s) => s.setModelId)
  const prompt = useImageStore((s) => s.prompt)
  const params = useImageStore((s) => s.params)
  const sizePreset = useImageStore((s) => s.sizePreset)
  const refs = useImageStore((s) => s.refs)
  const activeTaskId = useImageStore((s) => s.activeTaskId)
  const setActiveTaskId = useImageStore((s) => s.setActiveTaskId)

  const [providers, setProviders] = useState(fallbackProviders)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState('')
  const [paramsDrawerOpen, setParamsDrawerOpen] = useState(false)

  // session
  useEffect(() => {
    let cancelled = false
    setAuthLoading(true)
    Promise.all([fetchMe(), fetchQuotaSummary()])
      .then(([user, quota]) => !cancelled && setSession({ user, quota }))
      .catch(() => !cancelled && clearSession())
      .finally(() => !cancelled && setAuthLoading(false))
    return () => {
      cancelled = true
    }
  }, [setAuthLoading, setSession, clearSession])

  // models
  useEffect(() => {
    let cancelled = false
    fetchModels()
      .then((groups) => {
        if (cancelled) return
        const decorated = groups.map(decorateProvider).filter((p) => p.models.length > 0)
        setProviders(decorated.length > 0 ? decorated : fallbackProviders)
      })
      .catch(() => setProviders(fallbackProviders))
    return () => {
      cancelled = true
    }
  }, [])

  // load tasks
  useEffect(() => {
    ;(async () => {
      try {
        const cleaned = await cleanOrphanImages()
        if (cleaned > 0) console.info(`[image] cleaned ${cleaned} orphan images`)
        const tasks = await listTasks()
        setTaskIndex(tasks)
      } catch (err) {
        console.warn('[image] load tasks failed', err)
      }
    })()
  }, [setTaskIndex])

  const imageModels = useMemo(() => {
    return providers.flatMap((p) =>
      p.models.filter(isImageGenerationModel).map((m) => ({
        id: m.id,
        name: m.name,
        remark: m.remark,
        providerName: p.name,
        color: p.color,
        initial: p.initial
      }))
    )
  }, [providers])

  useEffect(() => {
    if (!modelId && imageModels.length > 0) setModelId(imageModels[0].id)
    if (modelId && imageModels.length > 0 && !imageModels.find((m) => m.id === modelId)) {
      setModelId(imageModels[0].id)
    }
  }, [imageModels, modelId, setModelId])

  const selectedModel = imageModels.find((m) => m.id === modelId)

  const handleGenerate = async () => {
    setError('')
    if (!isAuthenticated) {
      router.push('/login')
      return
    }
    if (!prompt.trim()) return setError('请填写提示词')
    if (!modelId) return setError('请选择图片生成模型')

    const taskId = newTaskId()
    const baseTask = {
      id: taskId,
      status: 'running',
      prompt: prompt.trim(),
      modelId,
      modelName: selectedModel?.name,
      params: { ...params },
      sizePreset: { ...sizePreset },
      refs: refs.map((r) => r.hash),
      outputs: [],
      error: null,
      createdAt: Date.now(),
      finishedAt: null,
      durationMs: null
    }
    await upsertTask(baseTask)
    addTaskToIndex(baseTask)

    setIsGenerating(true)
    const startedAt = performance.now()

    try {
      const basePayload = {
        model: modelId,
        prompt: baseTask.prompt,
        size: params.size,
        quality: params.quality,
        output_format: params.output_format,
        moderation: params.moderation,
        n: params.n
      }
      if (params.output_format === 'jpeg' || params.output_format === 'webp') {
        basePayload.output_compression = params.output_compression
      }

      let result
      if (refs.length > 0) {
        const refDataUrls = []
        for (const r of refs) {
          const rec = await getImage(r.hash)
          if (!rec) continue
          refDataUrls.push(await blobToDataUrl(rec.blob))
        }
        result = await editImageRequest({ ...basePayload, images: refDataUrls })
      } else {
        result = await generateImageRequest(basePayload)
      }

      const outputHashes = []
      const images = Array.isArray(result?.images) ? result.images : []
      for (const src of images) {
        try {
          const blob = await urlToBlob(src)
          let dim = { width: null, height: null }
          try {
            dim = await getImageDimensions(blob)
          } catch {}
          const hash = await sha256Hex(blob)
          await putImage({
            hash,
            blob,
            type: blob.type || `image/${params.output_format}`,
            width: dim.width,
            height: dim.height
          })
          outputHashes.push(hash)
        } catch (err) {
          console.warn('[image] failed to save output', err)
        }
      }

      const finalTask = {
        ...baseTask,
        status: outputHashes.length > 0 ? 'done' : 'failed',
        outputs: outputHashes,
        finishedAt: Date.now(),
        durationMs: Math.round(performance.now() - startedAt),
        error: outputHashes.length === 0 ? '没有生成结果' : null,
        requestId: result?.requestId
      }
      await upsertTask(finalTask)
      updateTaskInIndex(taskId, { status: finalTask.status, prompt: finalTask.prompt })

      if (outputHashes.length > 0) {
        toast({
          variant: 'success',
          title: '生成完成',
          description: `${outputHashes.length} 张图已加入历史`
        })
      } else {
        toast({ variant: 'error', title: '生成失败', description: '后端未返回图片' })
      }
    } catch (err) {
      const message = err?.message || '生成失败'
      const finalTask = {
        ...baseTask,
        status: 'failed',
        finishedAt: Date.now(),
        durationMs: Math.round(performance.now() - startedAt),
        error: message
      }
      await upsertTask(finalTask)
      updateTaskInIndex(taskId, { status: 'failed' })
      setError(message)
      toast({ variant: 'error', title: '生成失败', description: message })
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <Shell workspace="image">
      <div className="flex flex-1 flex-col overflow-y-auto pl-safe pr-safe scrollbar-thin">
        <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 md:px-8 md:py-10">
          <ImageHero isAuthenticated={isAuthenticated} taskCount={taskIndex.length} />

          {/* Default image model + mobile params row */}
          <div className="mb-3 flex items-center justify-between gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              默认生图模型
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setParamsDrawerOpen(true)}
                className="flex h-9 items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-xs text-slate-200 transition hover:bg-white/[0.08] md:hidden tap-transparent"
                aria-label="调整参数"
              >
                <SlidersHorizontal size={13} />
                <span>{describeSize(params.size)}</span>
                <span className="text-[10px] text-slate-500">· n={params.n}</span>
              </button>
              <div className="flex h-9 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-sm text-white">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: selectedModel?.color || '#a855f7' }}
                />
                <span className="font-medium">{selectedModel?.name || '自动选择'}</span>
                {selectedModel?.providerName && (
                  <span className="text-[10px] text-slate-500">{selectedModel.providerName}</span>
                )}
              </div>
            </div>
          </div>

          {/* Workbench: composer + refs (mobile) | composer + refs + params (desktop) */}
          <div className="grid gap-3 md:gap-4 md:grid-cols-[minmax(0,1fr)_300px]">
            <div className="space-y-3 md:space-y-4">
              <PromptComposer
                onGenerate={handleGenerate}
                isGenerating={isGenerating}
                modelName={selectedModel?.name}
                error={error}
              />
              <ReferenceUploader />
            </div>

            {/* Desktop params */}
            <div className="hidden md:block card-glass h-fit sticky top-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  参数
                </span>
                <Wand2 size={12} className="text-fuchsia-300" />
              </div>
              <ParamsPanel />
            </div>
          </div>

          {/* Gallery */}
          <div className="mt-8 md:mt-10">
            <div className="mb-3 flex items-end justify-between md:mb-4">
              <div>
                <h2 className="text-lg font-semibold text-white md:text-xl">最近任务</h2>
                <p className="mt-0.5 text-[11px] text-slate-500 md:text-xs">
                  共 {taskIndex.length} 个任务 · 点击卡片查看大图
                </p>
              </div>
            </div>
            <TaskGallery onSelect={setActiveTaskId} />
          </div>
        </div>
      </div>

      <TaskDetailDialog
        taskId={activeTaskId}
        onClose={() => setActiveTaskId(null)}
      />

      <ParamsDrawer
        open={paramsDrawerOpen}
        onClose={() => setParamsDrawerOpen(false)}
      />
    </Shell>
  )
}

export default function ImagePage() {
  return (
    <ToastProvider>
      <ImagePageInner />
    </ToastProvider>
  )
}
