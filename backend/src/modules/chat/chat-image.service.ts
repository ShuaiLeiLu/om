import { BadRequestException, Injectable } from '@nestjs/common'
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
  readJsonBody
} from './chat.util'

type PersistedImageResult = { id?: string; url: string }
type ImageModelConfig = {
  provider?: string
  displayName?: string
  sub2apiModel: string
  remark?: string
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
export class ChatImageService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly quota: QuotaService,
    private readonly images: ImagesService,
    private readonly models: ModelsService,
    private readonly config: ConfigService,
    private readonly sub2api: Sub2apiService
  ) {}

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
      const sub2apiBaseUrl = this.config.get<string>('SUB2API_BASE_URL') || ''
      const gatewayKey = gatewayKeyForRequest(this.config, requestId, { image: true })
      if (!sub2apiBaseUrl || !gatewayKey) throw new BadRequestException('sub2api_config_incomplete')

      const endpoint = options.mode === 'edits' ? '/v1/images/edits' : '/v1/images/generations'
      const fetchInit = await this.buildImageFetchInit(
        userId,
        `${sub2apiBaseUrl.replace(/\/$/, '')}${endpoint}`,
        gatewayKey,
        requestId,
        model.sub2apiModel,
        prompt,
        input,
        options.mode
      )

      const upstream = await fetch(fetchInit.url, fetchInit.init)
      const data = asImageGenerationResponse(await readJsonBody(upstream))
      if (!upstream.ok) throw imageUpstreamException(data, upstream.status)

      const fallbackMime = this.fallbackMimeForFormat(input.output_format)
      const images = (data.data || [])
        .map((item) => item.url || (item.b64_json ? `data:${fallbackMime};base64,${item.b64_json}` : ''))
        .filter(Boolean)
      if (images.length === 0) throw new Error('image_generation_empty')
      const persisted = await this.persistImagesIfEnabled(userId, images, fallbackMime, requestId)
      const responseImages = persisted.map((image) => image.url)

      const revisedPrompts = (data.data || [])
        .map((item) => item.revised_prompt)
        .filter((value): value is string => Boolean(value))
      const assistantContent = revisedPrompts[0]
        ? `生成图片：${revisedPrompts[0]}`
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
          sub2apiRequestId: extractUpstreamRequestId(upstream) || requestId,
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
                revisedPrompt: revisedPrompts[ordinal]
              }
            })
          }
          await tx.imageTask.update({
            where: { id: imageTask.id },
            data: {
              status: 'done',
              finishedAt: new Date(),
              sub2apiRequestId: extractUpstreamRequestId(upstream) || requestId
            }
          })
        })
      }
      await this.sub2api.ingestCompletionUsage({
        requestId,
        sub2apiRequestId: extractUpstreamRequestId(upstream) || requestId,
        model: model.sub2apiModel,
        usage: data.usage,
        raw: { source: options.mode === 'edits' ? 'image_edit' : 'image_generation' }
      })
      return {
        requestId,
        taskId: imageTask?.id,
        model: model.sub2apiModel,
        conversationId: conversation?.id || null,
        content: assistantContent,
        usage: data.usage || {},
        images: responseImages
      }
    } catch (error) {
      await this.prisma.llmRequest.update({
        where: { id: llmRequest.id },
        data: {
          status: 'failed',
          errorMessage: error instanceof Error ? error.message : String(error),
          completedAt: new Date()
        }
      })
      if (imageTask) {
        await this.prisma.imageTask
          .update({
            where: { id: imageTask.id },
            data: {
              status: 'failed',
              error: error instanceof Error ? error.message : String(error),
              finishedAt: new Date()
            }
          })
          .catch(() => undefined)
      }
      throw error
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
        persisted.push({
          url: `data:${decoded.contentType};base64,${decoded.buffer.toString('base64')}`
        })
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
          signal: AbortSignal.timeout(180000)
        } as RequestInit
      }
    }
    // edits → multipart/form-data
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
      form.append('image[]', blob, `ref_${ordinal}.${ext}`)
      ordinal += 1
    }
    for (const file of edit.decodedImages || []) {
      const blob = new Blob([new Uint8Array(file.buffer)], { type: file.contentType })
      const ext = this.extFromBlob(blob)
      form.append('image[]', blob, `ref_${ordinal}.${ext}`)
      ordinal += 1
    }
    for (const dataUrl of edit.images || []) {
      const blob = this.dataUrlToBlob(dataUrl)
      const ext = this.extFromBlob(blob)
      form.append('image[]', blob, `ref_${ordinal}.${ext}`)
      ordinal += 1
    }
    return {
      url,
      init: {
        method: 'POST',
        headers: baseHeaders, // do NOT set Content-Type; fetch+FormData will set the boundary
        body: form,
        signal: AbortSignal.timeout(180000)
      } as RequestInit
    }
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
