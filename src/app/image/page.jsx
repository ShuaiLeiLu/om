'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { SlidersHorizontal, Wand2 } from 'lucide-react'
import Shell from '@/components/layout/Shell'
import { useAuthStore } from '@/store/useStore'
import { useImageStore, newTaskId } from '@/store/useImageStore'
import { fetchModels, fetchMe, fetchPointsSummary } from '@/lib/api'
import { decorateProvider, fallbackProviders } from '@/lib/config'
import { isImageGenerationModel } from '@/lib/model-badges'
import { describeSize } from '@/lib/image/size'
import {
  listTasks,
  upsertTask,
  deleteTask,
  listDeletedServerTaskIds,
  markStaleRunningTasks,
  cleanOrphanImages,
  putImage,
  getImage
} from '@/lib/image/db'
import { sha256Hex } from '@/lib/image/hash'
import {
  generateImageRequest,
  editImageRequest,
  fetchServerImageTasks,
  urlToBlob,
  getImageDimensions,
  splitMidjourneyGrid
} from '@/lib/image/api'
import { ToastProvider, useToast } from '@/components/ui/toast'
import ImageHero from '@/components/image/ImageHero'
import PromptComposer from '@/components/image/PromptComposer'
import ParamsPanel from '@/components/image/ParamsPanel'
import ParamsDrawer from '@/components/image/ParamsDrawer'
import ReferenceUploader from '@/components/image/ReferenceUploader'
import TaskGallery from '@/components/image/TaskGallery'
import TaskDetailDialog from '@/components/image/TaskDetailDialog'
import ImageModelPicker from '@/components/image/ImageModelPicker'
import { imageCountLimitText, isValidImageSize, normalizeImageCount } from '@/lib/image/size'

function ImagePageInner() {
  const router = useRouter()
  const { isAuthenticated, isLoading: isAuthLoading, setAuthLoading, setSession, clearSession } = useAuthStore()
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
  const setFilter = useImageStore((s) => s.setFilter)

  const [providers, setProviders] = useState(fallbackProviders)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState('')
  const [paramsDrawerOpen, setParamsDrawerOpen] = useState(false)

  // session
  useEffect(() => {
    let cancelled = false
    setAuthLoading(true)
    fetchMe()
      .then(async (user) => {
        if (cancelled) return
        setSession({ user, points: null })
        try {
          const points = await fetchPointsSummary()
          if (!cancelled) setSession({ user, points })
        } catch (err) {
          console.warn('[image] points refresh failed', err)
        }
      })
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
        const stale = await markStaleRunningTasks()
        if (stale > 0) console.info(`[image] marked ${stale} stale running tasks`)
        const split = await splitExistingMidjourneyGrids()
        if (split > 0) console.info(`[image] split ${split} Midjourney grid tasks`)
        const restored = await restoreServerImageTasks()
        if (restored > 0) {
          console.info(`[image] restored ${restored} server image tasks`)
          setFilter('all')
        }
        const cleaned = await cleanOrphanImages()
        if (cleaned > 0) console.info(`[image] cleaned ${cleaned} orphan images`)
        const tasks = await listTasks()
        setTaskIndex(tasks)
      } catch (err) {
        console.warn('[image] load tasks failed', err)
      }
    })()
  }, [setTaskIndex, setFilter, isAuthenticated])

  async function restoreServerImageTasks() {
    if (!isAuthenticated) return 0
    const [localTasks, serverTasks] = await Promise.all([
      listTasks(),
      fetchServerImageTasks({ limit: 30 })
    ])
    const deletedServerTaskIds = new Set(await listDeletedServerTaskIds())
    const staleServerTasks = localTasks.filter((task) =>
      String(task.id || '').startsWith('server_') &&
      (task.status !== 'done' || !Array.isArray(task.outputs) || task.outputs.length === 0)
    )
    await Promise.all(staleServerTasks.map((task) => deleteTask(task.id)))
    const activeLocalTasks = localTasks.filter((task) => !staleServerTasks.includes(task))
    const localIds = new Set(activeLocalTasks.map((task) => task.serverTaskId || task.id))
    let restored = 0
    let downloadedImages = 0
    for (const serverTask of serverTasks) {
      if (deletedServerTaskIds.has(serverTask.id)) continue
      if (localIds.has(serverTask.id)) continue
      const images = Array.isArray(serverTask.images) ? serverTask.images : []
      if (serverTask.status !== 'done' || images.length === 0) continue
      const outputs = []
      for (const image of images) {
        if (!image?.url || downloadedImages >= 10) continue
        try {
          const blob = await urlToBlob(image.url)
          let dim = { width: image.width || null, height: image.height || null }
          if (!dim.width || !dim.height) {
            try {
              dim = await getImageDimensions(blob)
            } catch {}
          }
          const hash = await sha256Hex(blob)
          await putImage({
            hash,
            blob,
            type: blob.type || image.contentType || 'image/png',
            width: dim.width,
            height: dim.height
          })
          outputs.push(hash)
          downloadedImages += 1
        } catch (err) {
          console.warn('[image] failed to restore server output', err)
        }
      }
      if (outputs.length === 0) continue
      const serverCreatedAt = serverTask.createdAt ? new Date(serverTask.createdAt).getTime() : Date.now()
      const createdAt = Date.now() - restored
      const finishedAt = serverTask.finishedAt ? new Date(serverTask.finishedAt).getTime() : null
      await upsertTask({
        id: `server_${serverTask.id}`,
        serverTaskId: serverTask.id,
        serverCreatedAt,
        requestId: serverTask.requestId,
        status: 'done',
        prompt: serverTask.prompt || '',
        modelId: serverTask.modelId,
        modelName: serverTask.modelId,
        params: serverTask.params || {},
        sizePreset: null,
        refs: [],
        outputs,
        error: serverTask.error || null,
        createdAt,
        finishedAt,
        durationMs: serverTask.durationMs || (finishedAt ? Math.max(0, finishedAt - createdAt) : null)
      })
      restored += 1
    }
    return restored
  }

  async function splitExistingMidjourneyGrids() {
    const tasks = await listTasks()
    let updated = 0
    for (const task of tasks) {
      if (task.modelId !== 'midjourney' || task.status !== 'done' || task.outputs?.length !== 1) continue
      const source = await getImage(task.outputs[0])
      if (!source?.blob) continue
      const parts = await splitMidjourneyGrid(source.blob, source.blob.type || source.type || 'image/png')
      if (parts.length !== 4) continue
      const hashes = []
      for (const blob of parts) {
        let dim = { width: null, height: null }
        try {
          dim = await getImageDimensions(blob)
        } catch {}
        const hash = await sha256Hex(blob)
        await putImage({
          hash,
          blob,
          type: blob.type || source.type || 'image/png',
          width: dim.width,
          height: dim.height
        })
        hashes.push(hash)
      }
      await upsertTask({
        ...task,
        outputs: hashes,
        params: { ...(task.params || {}), midjourneyGridSplit: true }
      })
      updated += 1
    }
    return updated
  }

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
    if (isAuthLoading) {
      setError('正在同步登录状态，请稍候')
      return
    }
    if (!isAuthenticated) {
      router.push('/login?next=/image')
      return
    }
    if (!prompt.trim()) return setError('请填写提示词')
    if (!modelId) return setError('请选择图片生成模型')
    if (refs.length > 0 && modelId === 'midjourney') {
      return setError('MJ 生图暂不支持参考图，请切换到 GPT Image 2')
    }
    if (!isValidImageSize(params.size)) return setError('当前尺寸不符合 image2 支持范围')

    const imageCount = normalizeImageCount(params.n, params.size)
    if (imageCount !== params.n) {
      setError(imageCountLimitText(params.size) || '生成数量已超过当前尺寸限制')
      return
    }

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
        n: imageCount
      }
      if (params.output_format === 'jpeg' || params.output_format === 'webp') {
        basePayload.output_compression = params.output_compression
      }

      let result
      if (refs.length > 0) {
        const refBlobs = []
        for (const r of refs) {
          const rec = await getImage(r.hash)
          if (!rec) continue
          const mime = rec.blob.type || 'image/png'
          const ext = mime.includes('jpeg') ? 'jpg' : mime.includes('webp') ? 'webp' : mime.includes('gif') ? 'gif' : 'png'
          refBlobs.push({ blob: rec.blob, ext })
        }
        result = await editImageRequest({ ...basePayload, refBlobs })
      } else {
        result = await generateImageRequest(basePayload)
      }

      const outputHashes = []
      const images = Array.isArray(result?.images) ? result.images : []
      const shouldSplitGrid = modelId === 'midjourney'
      for (const src of images) {
        try {
          const blob = await urlToBlob(src)
          const blobs = shouldSplitGrid
            ? await splitMidjourneyGrid(blob, blob.type || `image/${params.output_format}`)
            : [blob]
          for (const outputBlob of blobs) {
            let dim = { width: null, height: null }
            try {
              dim = await getImageDimensions(outputBlob)
            } catch {}
            const hash = await sha256Hex(outputBlob)
            await putImage({
              hash,
              blob: outputBlob,
              type: outputBlob.type || blob.type || `image/${params.output_format}`,
              width: dim.width,
              height: dim.height
            })
            outputHashes.push(hash)
          }
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
      updateTaskInIndex(taskId, {
        status: finalTask.status,
        prompt: finalTask.prompt,
        outputs: finalTask.outputs,
        finishedAt: finalTask.finishedAt
      })

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
        <div className="w-full px-4 py-5 sm:px-6 md:px-8 lg:px-10 md:py-8">
          <ImageHero isAuthenticated={isAuthenticated} isAuthLoading={isAuthLoading} taskCount={taskIndex.length} />

          {/* Image model + mobile params row */}
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <ImageModelPicker
                models={imageModels}
                value={modelId}
                onChange={setModelId}
              />
            </div>
            <button
              onClick={() => setParamsDrawerOpen(true)}
              className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-ink-700/10 bg-rice-50 px-2.5 text-xs text-ink-700 transition hover:bg-rice-100 sm:h-9 sm:px-3 md:hidden tap-transparent"
              aria-label="调整参数"
            >
              <SlidersHorizontal size={13} />
              <span>{describeSize(params.size)}</span>
              <span className="text-[10px] text-ink-500">n={params.n}</span>
            </button>
          </div>

          {/* Workbench: composer + refs (mobile) | composer + refs + params (desktop) */}
          <div className="grid gap-3 md:gap-5 md:grid-cols-[minmax(0,1fr)_320px] lg:grid-cols-[minmax(0,1fr)_360px]">
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
            <div className="hidden md:block card-glass h-fit sticky top-4 p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-[10px] text-ink-500 label-zh">
                  参 数
                </span>
                <Wand2 size={12} className="text-celadon-600" />
              </div>
              <ParamsPanel />
            </div>
          </div>

          {/* Gallery */}
          <div className="mt-6 md:mt-10">
            <div className="mb-2.5 flex items-end justify-between md:mb-4">
              <div>
                <h2 className="font-serif text-base font-semibold text-ink-900 sm:text-lg md:text-xl">最近任务</h2>
                <p className="mt-0.5 text-[10px] text-ink-500 sm:text-[11px] md:text-xs">
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
