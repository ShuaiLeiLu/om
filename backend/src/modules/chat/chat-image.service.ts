import {
  BadRequestException,
  ForbiddenException,
  GatewayTimeoutException,
  Injectable,
  NotFoundException,
  OnModuleInit
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { randomToken } from '../../common/http'
import { ImagesService } from '../images/images.service'
import { ModelsService } from '../models/models.service'
import { PrismaService } from '../prisma/prisma.service'
import { QuotaService } from '../quota/quota.service'
import { Sub2apiService } from '../sub2api/sub2api.service'
import {
  asImageGenerationResponse,
  extractUpstreamRequestId,
  gatewayKeyForRequest,
  imageUpstreamException,
  StreamUsage,
  readJsonBody
} from './chat.util'

type PersistedImageResult = { id?: string; url: string }
type LocalGeneratedImage = { userId: string; buffer: Buffer; contentType: string; expiresAt: number }
type ImageUpstreamResult = {
  images: string[]
  revisedPrompts: string[]
  sub2apiRequestId: string
  source: string
  usage?: StreamUsage
  raw?: Record<string, unknown>
}
type ImageModelConfig = {
  provider?: string
  displayName?: string
  sub2apiModel: string
  remark?: string
}
type MidjourneySubmitResult = {
  code?: number
  description?: string
  result?: unknown
  properties?: Record<string, unknown>
}
type MidjourneyTaskInfo = {
  id?: string
  status?: string
  prompt?: string
  promptEn?: string
  description?: string
  failReason?: string
  imageUrl?: string
  baseImageUrl?: string
  proxyUrl?: string
  url?: string
  progress?: string
  imageUrls?: Array<{ url?: string; thumbnail?: string }>
}

export type ImageGenerateInput = {
  conversationId?: string
  model: string
  prompt: string
  size?: string
  quality?: 'low' | 'medium' | 'high'
  output_format?: 'png' | 'jpeg' | 'webp'
  output_compression?: number
  moderation?: 'auto' | 'low'
  n?: number
}
export type DecodedReferenceImage = { buffer: Buffer; contentType: string }
export type ImageEditInput = ImageGenerateInput & {
  images: string[] // legacy array of data URLs (data:image/...;base64,...)
  imageIds?: string[] // uploaded reference image ids from POST /api/images/uploads
  decodedImages?: DecodedReferenceImage[] // multipart-uploaded reference images (preferred path)
}

const MAX_IMAGE_PROMPT_LENGTH = 4000
const MAX_REFERENCE_IMAGES = 16
const MAX_REFERENCE_IMAGE_BYTES = 25 * 1024 * 1024
const MAX_REFERENCE_IMAGES_TOTAL_BYTES = 100 * 1024 * 1024
const MIN_IMAGE_SIDE = 16
const MAX_IMAGE_SIDE = 3840
const MIN_IMAGE_PIXELS = 655_360
const MAX_IMAGE_PIXELS = 3840 * 2160
const MAX_IMAGE_ASPECT_RATIO = 3
const IMAGE_SIZE_STEP = 16
const MAX_IMAGE_COUNT = 4
const DEFAULT_IMAGE_UPSTREAM_TIMEOUT_MS = 10 * 60 * 1000
const DEFAULT_LOCAL_GENERATED_IMAGE_TTL_MS = 30 * 60 * 1000
const IMAGE_MODEL_MARKERS = [
  'image',
  'image2',
  'gpt-image',
  'dall-e',
  'imagen',
  'stable-diffusion',
  'stable diffusion',
  'flux',
  'midjourney',
  'jimeng',
  'seedream',
  'qwen-image',
  'wanx'
]

@Injectable()
export class ChatImageService implements OnModuleInit {
  private readonly localGeneratedImages = new Map<string, LocalGeneratedImage>()

  constructor(
    private readonly prisma: PrismaService,
    private readonly quota: QuotaService,
    private readonly images: ImagesService,
    private readonly models: ModelsService,
    private readonly config: ConfigService,
    private readonly sub2api: Sub2apiService
  ) {}

  async onModuleInit() {
    if (this.config.get<string>('IMAGE_REQUEST_RECOVERY_ON_STARTUP') === 'false') return
    await this.prisma.llmRequest.updateMany({
      where: {
        status: 'streaming',
        modelId: { in: ['gpt-image-2', 'midjourney'] }
      },
      data: {
        status: 'failed',
        errorMessage: 'image_request_interrupted',
        completedAt: new Date()
      }
    })
  }

  async generateImage(userId: string, input: ImageGenerateInput) {
    return this.runImageRequest(userId, input, { mode: 'generations' })
  }

  async editImage(userId: string, input: ImageEditInput) {
    const referenceCount = this.referenceImageCount(input)
    if (referenceCount === 0 || referenceCount > MAX_REFERENCE_IMAGES) {
      throw new BadRequestException('too_many_reference_images')
    }
    return this.runImageRequest(userId, input, { mode: 'edits' })
  }

  generatedImageForUser(userId: string, token: string) {
    this.cleanupLocalGeneratedImages()
    const image = this.localGeneratedImages.get(token)
    if (!image) throw new NotFoundException('generated_image_not_found')
    if (image.userId !== userId) throw new ForbiddenException('generated_image_forbidden')
    return { buffer: image.buffer, contentType: image.contentType }
  }

  private async runImageRequest(
    userId: string,
    input: ImageGenerateInput | ImageEditInput,
    options: { mode: 'generations' | 'edits' }
  ) {
    const prompt = (input.prompt || '').trim()
    if (!prompt || prompt.length > MAX_IMAGE_PROMPT_LENGTH) throw new BadRequestException('invalid_prompt')

    this.validateImageParams(input)
    if (options.mode === 'edits') this.validateReferenceImages(input as ImageEditInput)

    const balance = await this.quota.balance(userId)
    if (balance <= BigInt(0)) throw new BadRequestException('token_insufficient')
    const model = await this.models.assertEnabled(input.model)
    if (!this.isImageModel(model)) throw new BadRequestException('model_disabled')
    const requestId = randomToken(18)
    const conversation = input.conversationId
      ? await this.prisma.conversation.findFirst({ where: { id: input.conversationId, userId } })
      : null
    if (input.conversationId && !conversation) throw new BadRequestException('conversation_not_found')

    if (conversation) {
      await this.prisma.message.create({
        data: {
          conversationId: conversation.id,
          userId,
          role: 'user',
          content: prompt,
          modelId: model.sub2apiModel
        }
      })
    }

    const llmRequest = await this.prisma.llmRequest.create({
      data: {
        requestId,
        userId,
        conversationId: conversation?.id,
        modelId: model.sub2apiModel,
        status: 'streaming',
        startedAt: new Date()
      }
    })
    const imageTask = this.config.get<string>('IMAGE_BACKEND') === 'minio'
      ? await this.prisma.imageTask.create({
          data: {
            userId,
            conversationId: conversation?.id,
            mode: options.mode === 'edits' ? 'edit' : 'generate',
            modelId: model.sub2apiModel,
            prompt,
            paramsJson: this.imageParamsJson(input),
            status: 'running',
            requestId,
            startedAt: new Date()
          }
        })
      : null

    try {
      const upstreamResult = this.isMidjourneyModel(model)
        ? await this.runMidjourneyImageRequest(userId, requestId, model, prompt, input)
        : await this.runOpenAiImageRequest(userId, requestId, model, prompt, input, options.mode)
      const fallbackMime = this.fallbackMimeForFormat(input.output_format)
      if (upstreamResult.images.length === 0) throw new Error('image_generation_empty')
      const persisted = await this.persistImagesIfEnabled(userId, upstreamResult.images, fallbackMime, requestId)
      const responseImages = persisted.map((image) => image.url)

      const assistantContent = upstreamResult.revisedPrompts[0]
        ? `生成图片：${upstreamResult.revisedPrompts[0]}`
        : options.mode === 'edits'
          ? '参考图编辑完成'
          : '图片已生成'
      if (conversation) {
        await this.prisma.message.create({
          data: {
            conversationId: conversation.id,
            userId,
            role: 'assistant',
            content: assistantContent,
            imagesJson: responseImages,
            modelId: model.sub2apiModel,
            status: 'completed'
          }
        })
      }
      await this.prisma.llmRequest.update({
        where: { id: llmRequest.id },
        data: {
          sub2apiRequestId: upstreamResult.sub2apiRequestId || requestId,
          status: 'completed',
          completedAt: new Date()
        }
      })
      if (imageTask) {
        await this.prisma.$transaction(async (tx) => {
          for (const [ordinal, imageId] of ((input as ImageEditInput).imageIds || []).entries()) {
            await tx.imageTaskInput.create({
              data: { taskId: imageTask.id, imageId, ordinal }
            })
          }
          for (const [ordinal, image] of persisted.entries()) {
            if (!image.id) continue
            await tx.imageTaskOutput.create({
              data: {
                taskId: imageTask.id,
                imageId: image.id,
                ordinal,
                revisedPrompt: upstreamResult.revisedPrompts[ordinal]
              }
            })
          }
          await tx.imageTask.update({
            where: { id: imageTask.id },
            data: {
              status: 'done',
              finishedAt: new Date(),
              sub2apiRequestId: upstreamResult.sub2apiRequestId || requestId
            }
          })
        })
      }
      await this.sub2api.ingestCompletionUsage({
        requestId,
        sub2apiRequestId: upstreamResult.sub2apiRequestId || requestId,
        model: model.sub2apiModel,
        usage: upstreamResult.usage,
        raw: {
          source: upstreamResult.source,
          sub2apiRequestId: upstreamResult.sub2apiRequestId,
          ...(upstreamResult.raw || {})
        }
      })
      return {
        requestId,
        taskId: imageTask?.id,
        model: model.sub2apiModel,
        conversationId: conversation?.id || null,
        content: assistantContent,
        usage: upstreamResult.usage || {},
        images: responseImages
      }
    } catch (error) {
      const normalizedError = this.normalizeImageRequestError(error)
      await this.prisma.llmRequest.update({
        where: { id: llmRequest.id },
        data: {
          status: 'failed',
          errorMessage: normalizedError instanceof Error ? normalizedError.message : String(normalizedError),
          completedAt: new Date()
        }
      })
      if (imageTask) {
        await this.prisma.imageTask
          .update({
            where: { id: imageTask.id },
            data: {
              status: 'failed',
              error: normalizedError instanceof Error ? normalizedError.message : String(normalizedError),
              finishedAt: new Date()
            }
          })
          .catch(() => undefined)
      }
      throw normalizedError
    }
  }

  private validateImageParams(input: ImageGenerateInput | ImageEditInput) {
    if (input.size && input.size !== 'auto') {
      if (!/^\d+x\d+$/i.test(input.size)) throw new BadRequestException('invalid_size')
      const [w, h] = input.size.split('x').map((n) => Number(n))
      const pixels = w * h
      const aspectRatio = Math.max(w / h, h / w)
      if (
        w < MIN_IMAGE_SIDE ||
        h < MIN_IMAGE_SIDE ||
        w > MAX_IMAGE_SIDE ||
        h > MAX_IMAGE_SIDE ||
        w % IMAGE_SIZE_STEP !== 0 ||
        h % IMAGE_SIZE_STEP !== 0 ||
        aspectRatio > MAX_IMAGE_ASPECT_RATIO ||
        pixels < MIN_IMAGE_PIXELS ||
        pixels > MAX_IMAGE_PIXELS
      ) {
        throw new BadRequestException('invalid_size')
      }
    }
    if (input.quality && !['low', 'medium', 'high'].includes(input.quality))
      throw new BadRequestException('invalid_quality')
    if (input.output_format && !['png', 'jpeg', 'webp'].includes(input.output_format))
      throw new BadRequestException('invalid_format')
    if (input.output_compression != null) {
      const c = Number(input.output_compression)
      if (!Number.isInteger(c) || c < 0 || c > 100) throw new BadRequestException('invalid_compression')
    }
    if (input.moderation && !['auto', 'low'].includes(input.moderation))
      throw new BadRequestException('invalid_moderation')
    const n = input.n == null ? 1 : Number(input.n)
    if (!Number.isInteger(n) || n < 1 || n > MAX_IMAGE_COUNT) throw new BadRequestException('invalid_n')
    const pixels = this.imagePixels(input.size)
    const maxForSize = pixels >= MAX_IMAGE_PIXELS * 0.9 ? 1 : pixels >= 2048 * 2048 * 0.9 ? 2 : MAX_IMAGE_COUNT
    if (n > maxForSize) throw new BadRequestException('image_count_too_large_for_size')
  }

  private imagePixels(size?: string) {
    if (!size || size === 'auto') return 1024 * 1024
    const [w, h] = size.split('x').map((n) => Number(n))
    return w * h
  }

  private validateReferenceImages(input: ImageEditInput) {
    let totalBytes = 0
    const check = (size: number) => {
      totalBytes += size
      if (size > MAX_REFERENCE_IMAGE_BYTES || totalBytes > MAX_REFERENCE_IMAGES_TOTAL_BYTES) {
        throw new BadRequestException('reference_image_too_large')
      }
    }
    for (const dataUrl of input.images || []) {
      const decoded = this.decodeReferenceImage(dataUrl)
      check(decoded.buffer.length)
    }
    for (const file of input.decodedImages || []) {
      check(file.buffer.length)
    }
  }

  private referenceImageCount(input: ImageEditInput) {
    return (
      (input.images || []).length +
      (input.imageIds || []).length +
      (input.decodedImages || []).length
    )
  }

  private isImageModel(model: ImageModelConfig) {
    const text = `${model.provider || ''} ${model.displayName || ''} ${model.sub2apiModel || ''} ${model.remark || ''}`.toLowerCase()
    return IMAGE_MODEL_MARKERS.some((marker) => text.includes(marker))
  }

  private fallbackMimeForFormat(format?: string) {
    if (format === 'jpeg') return 'image/jpeg'
    if (format === 'webp') return 'image/webp'
    return 'image/png'
  }

  private isMidjourneyModel(model: ImageModelConfig) {
    const text = `${model.provider || ''} ${model.displayName || ''} ${model.sub2apiModel || ''}`.toLowerCase()
    return text.includes('midjourney') || text === 'mj' || text.includes('mj 生图')
  }

  private async runOpenAiImageRequest(
    userId: string,
    requestId: string,
    model: ImageModelConfig,
    prompt: string,
    input: ImageGenerateInput | ImageEditInput,
    mode: 'generations' | 'edits'
  ): Promise<ImageUpstreamResult> {
    const sub2apiBaseUrl = this.config.get<string>('SUB2API_BASE_URL') || ''
    const gatewayKey = gatewayKeyForRequest(this.config, requestId, { image: true, model: model.sub2apiModel })
    if (!sub2apiBaseUrl || !gatewayKey) throw new BadRequestException('sub2api_config_incomplete')

    const endpoint = mode === 'edits' ? '/v1/images/edits' : '/v1/images/generations'
    const fetchInit = await this.buildImageFetchInit(
      userId,
      `${sub2apiBaseUrl.replace(/\/$/, '')}${endpoint}`,
      gatewayKey,
      requestId,
      model.sub2apiModel,
      prompt,
      input,
      mode
    )

    const upstream = await fetch(fetchInit.url, fetchInit.init)
    const data = asImageGenerationResponse(await readJsonBody(upstream))
    if (!upstream.ok) throw imageUpstreamException(data, upstream.status)

    const fallbackMime = this.fallbackMimeForFormat(input.output_format)
    return {
      images: (data.data || [])
        .map((item) => item.url || (item.b64_json ? `data:${fallbackMime};base64,${item.b64_json}` : ''))
        .filter(Boolean),
      revisedPrompts: (data.data || [])
        .map((item) => item.revised_prompt)
        .filter((value): value is string => Boolean(value)),
      sub2apiRequestId: extractUpstreamRequestId(upstream) || requestId,
      source: mode === 'edits' ? 'image_edit' : 'image_generation',
      usage: data.usage
    }
  }

  private async runMidjourneyImageRequest(
    userId: string,
    requestId: string,
    model: ImageModelConfig,
    prompt: string,
    input: ImageGenerateInput | ImageEditInput
  ): Promise<ImageUpstreamResult> {
    if (this.referenceImageCount(input as ImageEditInput) > 0) {
      throw new BadRequestException('midjourney_reference_images_not_supported')
    }
    const baseUrl = this.config.get<string>('SUB2API_BASE_URL') || ''
    const token = gatewayKeyForRequest(this.config, requestId, { image: true, model: model.sub2apiModel })
    if (!baseUrl || !token) throw new BadRequestException('sub2api_config_incomplete')

    const mjBaseUrl = baseUrl.replace(/\/$/, '')
    const headers = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-Chatty-Request-Id': requestId
    }
    const submit = await fetch(`${mjBaseUrl}/mj/submit/imagine`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        botType: 'MID_JOURNEY',
        prompt: this.midjourneyPrompt(prompt, input.size),
        state: requestId,
        accountFilter: { modes: [this.midjourneySpeedMode(model.sub2apiModel)] }
      }),
      signal: AbortSignal.timeout(Math.min(this.imageUpstreamTimeoutMs(), 60_000))
    })
    const submitData = (await readJsonBody(submit)) as MidjourneySubmitResult | null
    if (!submit.ok || !submitData || submitData.code !== 1) {
      throw imageUpstreamException(submitData, submit.status || 502)
    }
    const taskId = typeof submitData.result === 'string' ? submitData.result : String(submitData.result || '')
    if (!taskId) throw new Error('midjourney_task_id_missing')
    await this.recordMidjourneyTaskId(requestId, taskId)

    const task = await this.pollMidjourneyTask(mjBaseUrl, token, taskId, requestId)
    const imageUrls = [
      task.imageUrl,
      task.proxyUrl,
      task.url,
      task.baseImageUrl,
      ...(task.imageUrls || []).map((item) => item.url)
    ].filter((value): value is string => Boolean(value))
    if (imageUrls.length === 0) throw new Error(task.failReason || task.description || 'image_generation_empty')

    return {
      images: [imageUrls[0]],
      revisedPrompts: [task.promptEn || task.prompt || prompt].filter(Boolean),
      sub2apiRequestId: task.id || taskId,
      source: 'midjourney_imagine',
      raw: {
        model: model.sub2apiModel,
        midjourneyTaskId: task.id || taskId,
        status: task.status,
        progress: task.progress,
        userId
      }
    }
  }

  private async pollMidjourneyTask(baseUrl: string, token: string, taskId: string, requestId: string) {
    const startedAt = Date.now()
    const timeoutMs = this.imageUpstreamTimeoutMs()
    let delayMs = 3000
    while (Date.now() - startedAt < timeoutMs) {
      const res = await fetch(`${baseUrl}/mj/task/${encodeURIComponent(taskId)}/fetch`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
          'X-Chatty-Request-Id': requestId
        },
        signal: AbortSignal.timeout(30_000)
      })
      if (res.status === 204) {
        await this.sleep(delayMs)
        delayMs = Math.min(10_000, delayMs + 1000)
        continue
      }
      const task = (await readJsonBody(res)) as MidjourneyTaskInfo | null
      if (!res.ok) throw imageUpstreamException(task, res.status)
      const status = String(task?.status || '').toUpperCase()
      if (status === 'SUCCESS') return task || {}
      if (status === 'FAILURE' || status === 'CANCEL') {
        throw new Error(task?.failReason || task?.description || `midjourney_${status.toLowerCase()}`)
      }
      await this.sleep(delayMs)
      delayMs = Math.min(10_000, delayMs + 1000)
    }
    throw new GatewayTimeoutException({
      message: 'image_generation_timeout',
      detail: 'Midjourney 任务等待超时，请稍后重试'
    })
  }

  private midjourneyPrompt(prompt: string, size?: string) {
    if (!size || size === 'auto' || /(?:^|\s)--ar\s+\d+:\d+(?:\s|$)/i.test(prompt)) return prompt
    const match = /^(\d+)x(\d+)$/i.exec(size)
    if (!match) return prompt
    const w = Number(match[1])
    const h = Number(match[2])
    const divisor = this.gcd(w, h)
    return `${prompt} --ar ${w / divisor}:${h / divisor}`
  }

  private midjourneySpeedMode(modelId: string) {
    const id = modelId.toLowerCase()
    if (id.includes('turbo')) return 'TURBO'
    if (id.includes('relax')) return 'RELAX'
    return 'FAST'
  }

  private gcd(a: number, b: number): number {
    let x = Math.abs(a)
    let y = Math.abs(b)
    while (y) {
      const next = x % y
      x = y
      y = next
    }
    return x || 1
  }

  private sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  private async recordMidjourneyTaskId(requestId: string, taskId: string) {
    await Promise.all([
      this.prisma.llmRequest.updateMany({
        where: { requestId },
        data: { sub2apiRequestId: taskId }
      }),
      this.prisma.imageTask.updateMany({
        where: { requestId },
        data: { sub2apiRequestId: taskId }
      })
    ]).catch(() => undefined)
  }

  private async persistImagesIfEnabled(
    userId: string,
    images: string[],
    fallbackMime: string,
    requestId: string
  ): Promise<PersistedImageResult[]> {
    const persisted: PersistedImageResult[] = []
    for (const image of images) {
      const decoded = await this.imageToBuffer(image, fallbackMime)
      if (this.config.get<string>('IMAGE_BACKEND') !== 'minio') {
        const token = randomToken(24)
        this.localGeneratedImages.set(token, {
          userId,
          buffer: decoded.buffer,
          contentType: decoded.contentType,
          expiresAt: Date.now() + this.localGeneratedImageTtlMs()
        })
        persisted.push({ url: `/api/images/generated/${encodeURIComponent(token)}` })
        continue
      }
      const stored = await this.images.ingestFromBuffer({
        userId,
        buffer: decoded.buffer,
        contentType: decoded.contentType,
        source: 'generated',
        taskHint: requestId
      })
      persisted.push({ id: stored.id, url: stored.url })
    }
    return persisted
  }

  private imageParamsJson(input: ImageGenerateInput | ImageEditInput) {
    return {
      size: input.size || '1024x1024',
      quality: input.quality || 'medium',
      output_format: input.output_format || 'png',
      output_compression: input.output_compression,
      moderation: input.moderation || 'auto',
      n: input.n || 1,
      referenceImageIds: 'imageIds' in input ? input.imageIds || [] : []
    }
  }

  private async imageToBuffer(image: string, fallbackMime: string) {
    if (image.startsWith('data:')) {
      const match = /^data:(image\/(?:png|jpeg|jpg|webp|gif));base64,([A-Za-z0-9+/=\r\n]+)$/.exec(image)
      if (!match) throw new Error('invalid_generated_image')
      const contentType = match[1].toLowerCase() === 'image/jpg' ? 'image/jpeg' : match[1].toLowerCase()
      return { buffer: Buffer.from(match[2].replace(/\s/g, ''), 'base64'), contentType }
    }

    const res = await fetch(image, { signal: AbortSignal.timeout(30000) })
    if (!res.ok) throw new Error(`generated_image_download_${res.status}`)
    const contentType = (res.headers.get('content-type') || fallbackMime).split(';')[0].trim()
    const buffer = Buffer.from(await res.arrayBuffer())
    return { buffer, contentType }
  }

  private async buildImageFetchInit(
    userId: string,
    url: string,
    gatewayKey: string,
    requestId: string,
    model: string,
    prompt: string,
    input: ImageGenerateInput | ImageEditInput,
    mode: 'generations' | 'edits'
  ) {
    const baseHeaders: Record<string, string> = {
      Authorization: `Bearer ${gatewayKey}`,
      'X-Chatty-Request-Id': requestId
    }
    const upstreamTimeoutMs = this.imageUpstreamTimeoutMs()
    if (mode === 'generations') {
      const outputFormat = input.output_format || 'png'
      return {
        url,
        init: {
          method: 'POST',
          headers: { ...baseHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model,
            prompt,
            user: userId,
            n: input.n || 1,
            size: input.size || '1024x1024',
            quality: input.quality || 'medium',
            output_format: outputFormat,
            output_compression: outputFormat !== 'png' ? input.output_compression : undefined,
            moderation: input.moderation || 'auto'
          }),
          signal: AbortSignal.timeout(upstreamTimeoutMs)
        } as RequestInit
      }
    }
    // edits → multipart/form-data. OpenAI-compatible APIs expect repeated
    // `image` fields for multiple uploaded reference images.
    const edit = input as ImageEditInput
    const form = new FormData()
    const outputFormat = input.output_format || 'png'
    form.set('model', model)
    form.set('prompt', prompt)
    form.set('user', userId)
    form.set('n', String(input.n || 1))
    form.set('size', input.size || '1024x1024')
    form.set('quality', input.quality || 'medium')
    form.set('output_format', outputFormat)
    if (input.output_compression != null && outputFormat !== 'png') {
      form.set('output_compression', String(input.output_compression))
    }
    form.set('moderation', input.moderation || 'auto')
    let ordinal = 0
    for (const imageId of edit.imageIds || []) {
      const ref = await this.images.referenceBlobForUser(userId, imageId)
      const blob = new Blob([ref.buffer], { type: ref.contentType })
      const ext = this.extFromBlob(blob)
      form.append('image', blob, `ref_${ordinal}.${ext}`)
      ordinal += 1
    }
    for (const file of edit.decodedImages || []) {
      const blob = new Blob([new Uint8Array(file.buffer)], { type: file.contentType })
      const ext = this.extFromBlob(blob)
      form.append('image', blob, `ref_${ordinal}.${ext}`)
      ordinal += 1
    }
    for (const dataUrl of edit.images || []) {
      const blob = this.dataUrlToBlob(dataUrl)
      const ext = this.extFromBlob(blob)
      form.append('image', blob, `ref_${ordinal}.${ext}`)
      ordinal += 1
    }
    return {
      url,
      init: {
        method: 'POST',
        headers: baseHeaders, // do NOT set Content-Type; fetch+FormData will set the boundary
        body: form,
        signal: AbortSignal.timeout(upstreamTimeoutMs)
      } as RequestInit
    }
  }

  private imageUpstreamTimeoutMs() {
    const configured = Number(this.config.get<string>('IMAGE_UPSTREAM_TIMEOUT_MS'))
    if (Number.isFinite(configured) && configured > 0) return Math.floor(configured)
    return DEFAULT_IMAGE_UPSTREAM_TIMEOUT_MS
  }

  private localGeneratedImageTtlMs() {
    const configured = Number(this.config.get<string>('LOCAL_GENERATED_IMAGE_TTL_MS'))
    if (Number.isFinite(configured) && configured > 0) return Math.floor(configured)
    return DEFAULT_LOCAL_GENERATED_IMAGE_TTL_MS
  }

  private cleanupLocalGeneratedImages() {
    const now = Date.now()
    for (const [token, image] of this.localGeneratedImages.entries()) {
      if (image.expiresAt <= now) this.localGeneratedImages.delete(token)
    }
  }

  private normalizeImageRequestError(error: unknown) {
    if (!this.isTimeoutError(error)) return error
    return new GatewayTimeoutException({
      message: 'image_generation_timeout',
      detail: '上游图片服务响应超时，请稍后重试'
    })
  }

  private isTimeoutError(error: unknown) {
    if (!(error instanceof Error)) return false
    const message = error.message.toLowerCase()
    return error.name === 'TimeoutError' ||
      error.name === 'AbortError' ||
      message.includes('aborted due to timeout')
  }

  private dataUrlToBlob(dataUrl: string): Blob {
    const decoded = this.decodeReferenceImage(dataUrl)
    return new Blob([decoded.buffer], { type: decoded.type })
  }

  private decodeReferenceImage(dataUrl: string) {
    const match = /^data:(image\/(?:png|jpeg|jpg|webp|gif));base64,([A-Za-z0-9+/=\r\n]+)$/.exec(dataUrl)
    if (!match) throw new BadRequestException('invalid_reference_image')
    const type = match[1].toLowerCase() === 'image/jpg' ? 'image/jpeg' : match[1].toLowerCase()
    const base64 = match[2].replace(/\s/g, '')
    const buffer = Buffer.from(base64, 'base64')
    if (buffer.length === 0) throw new BadRequestException('invalid_reference_image')
    return { type, buffer }
  }

  private extFromBlob(blob: Blob) {
    const t = (blob.type || '').toLowerCase()
    if (t.includes('jpeg') || t.includes('jpg')) return 'jpg'
    if (t.includes('webp')) return 'webp'
    if (t.includes('gif')) return 'gif'
    return 'png'
  }
}
