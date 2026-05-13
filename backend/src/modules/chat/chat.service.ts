import { BadRequestException, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Response } from 'express'
import { randomToken } from '../../common/http'
import { ImagesService } from '../images/images.service'
import { ModelsService } from '../models/models.service'
import { PrismaService } from '../prisma/prisma.service'
import { QuotaService } from '../quota/quota.service'
import { Sub2apiService } from '../sub2api/sub2api.service'

type ChatMessageInput = { role: 'user' | 'assistant' | 'system'; content: string; images?: string[] }
type StreamUsage = { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number; promptTokens?: number; completionTokens?: number; totalTokens?: number }
type ImageGenerationResponse = {
  data?: Array<{ url?: string; b64_json?: string; revised_prompt?: string }>
  usage?: StreamUsage
}
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
export type ImageEditInput = ImageGenerateInput & {
  images: string[] // legacy array of data URLs (data:image/...;base64,...)
  imageIds?: string[] // uploaded reference image ids from POST /api/images/uploads
}

const MAX_IMAGE_PROMPT_LENGTH = 4000
const MAX_REFERENCE_IMAGES = 16
const MAX_REFERENCE_IMAGE_BYTES = 25 * 1024 * 1024
const MAX_REFERENCE_IMAGES_TOTAL_BYTES = 100 * 1024 * 1024
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
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly quota: QuotaService,
    private readonly images: ImagesService,
    private readonly models: ModelsService,
    private readonly config: ConfigService,
    private readonly sub2api: Sub2apiService
  ) {}

  async conversations(userId: string) {
    return this.prisma.conversation.findMany({
      where: { userId, status: 'active' },
      orderBy: { updatedAt: 'desc' }
    })
  }

  async createConversation(userId: string, input: { title?: string; defaultModelId?: string }) {
    return this.prisma.conversation.create({
      data: { userId, title: input.title || '新对话', defaultModelId: input.defaultModelId }
    })
  }

  async messages(userId: string, conversationId: string) {
    const conversation = await this.prisma.conversation.findFirst({ where: { id: conversationId, userId } })
    if (!conversation) throw new BadRequestException('conversation_not_found')
    return this.prisma.message.findMany({ where: { conversationId }, orderBy: { createdAt: 'asc' } })
  }

  async streamCompletion(userId: string, input: { conversationId?: string; model: string; messages: ChatMessageInput[] }, res: Response) {
    const balance = await this.quota.balance(userId)
    if (balance <= BigInt(0)) throw new BadRequestException('token_insufficient')
    const model = await this.models.assertEnabled(input.model)
    const requestId = randomToken(18)
    const conversation = input.conversationId
      ? await this.prisma.conversation.findFirst({ where: { id: input.conversationId, userId } })
      : await this.prisma.conversation.create({
          data: {
            userId,
            defaultModelId: model.sub2apiModel,
            title: this.titleFromMessages(input.messages)
          }
        })
    if (!conversation) throw new BadRequestException('conversation_not_found')

    const lastUser = [...input.messages].reverse().find((message) => message.role === 'user')
    if (lastUser) {
      await this.prisma.message.create({
        data: {
          conversationId: conversation.id,
          userId,
          role: 'user',
          content: lastUser.content || '',
          imagesJson: lastUser.images || undefined,
          modelId: model.sub2apiModel
        }
      })
    }

    const llmRequest = await this.prisma.llmRequest.create({
      data: {
        requestId,
        userId,
        conversationId: conversation.id,
        modelId: model.sub2apiModel,
        status: 'streaming',
        startedAt: new Date()
      }
    })

    this.writeSse(res, 'message.meta', { requestId, conversationId: conversation.id })
    let assistantContent = ''
    try {
      const sub2apiBaseUrl = this.config.get<string>('SUB2API_BASE_URL') || ''
      const gatewayKey = this.gatewayKeyForRequest(requestId)
      if (!sub2apiBaseUrl || !gatewayKey) throw new BadRequestException('sub2api_config_incomplete')

      const upstream = await fetch(`${sub2apiBaseUrl.replace(/\/$/, '')}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${gatewayKey}`,
          'X-Chatty-Request-Id': requestId
        },
        body: JSON.stringify({
          model: model.sub2apiModel,
          messages: input.messages.map((message) => ({ role: message.role, content: message.content })),
          stream: true,
          stream_options: { include_usage: true }
        }),
        signal: AbortSignal.timeout(120000)
      })
      if (!upstream.ok || !upstream.body) throw new Error(`sub2api_http_${upstream.status}`)
      const sub2apiRequestId = this.extractUpstreamRequestId(upstream) || requestId
      await this.prisma.llmRequest.update({
        where: { id: llmRequest.id },
        data: { sub2apiRequestId }
      })
      const reader = upstream.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let usage: StreamUsage | undefined
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''
        for (const line of lines) {
          const text = line.trim()
          if (!text.startsWith('data:')) continue
          const payload = text.slice(5).trim()
          if (payload === '[DONE]') continue
          const parsed = JSON.parse(payload) as { choices?: Array<{ delta?: { content?: string } }>; usage?: StreamUsage }
          if (parsed.usage) usage = parsed.usage
          const delta = parsed.choices?.[0]?.delta?.content || ''
          if (delta) {
            assistantContent += delta
            this.writeSse(res, 'message.delta', { content: delta })
          }
        }
      }
      await this.prisma.message.create({
        data: {
          conversationId: conversation.id,
          userId,
          role: 'assistant',
          content: assistantContent,
          modelId: model.sub2apiModel,
          status: 'completed'
        }
      })
      await this.prisma.llmRequest.update({
        where: { id: llmRequest.id },
        data: { status: 'completed', completedAt: new Date() }
      })
      const usageResult = await this.sub2api.ingestCompletionUsage({
        requestId,
        sub2apiRequestId,
        model: model.sub2apiModel,
        usage,
        raw: { source: 'chat_stream', sub2apiRequestId }
      })
      this.writeSse(res, 'message.done', { requestId, conversationId: conversation.id, usage: usageResult })
    } catch (error) {
      await this.prisma.llmRequest.update({
        where: { id: llmRequest.id },
        data: { status: 'failed', errorMessage: error instanceof Error ? error.message : String(error), completedAt: new Date() }
      })
      this.writeSse(res, 'message.error', { error: error instanceof Error ? error.message : 'chat_failed' })
    } finally {
      res.end()
    }
  }

  async generateImage(userId: string, input: ImageGenerateInput) {
    return this.runImageRequest(userId, input, { mode: 'generations' })
  }

  async editImage(userId: string, input: ImageEditInput) {
    const referenceCount = this.referenceImageCount(input)
    if (referenceCount === 0 || referenceCount > MAX_REFERENCE_IMAGES) throw new BadRequestException('too_many_reference_images')
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
      const gatewayKey = this.gatewayKeyForRequest(requestId)
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
      const data = this.asImageGenerationResponse(await this.readJson(upstream))
      if (!upstream.ok) throw new Error(this.upstreamErrorMessage(data, upstream.status))

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
          sub2apiRequestId: this.extractUpstreamRequestId(upstream) || requestId,
          status: 'completed',
          completedAt: new Date()
        }
      })
      if (imageTask) {
        await this.prisma.$transaction(async (tx) => {
          for (const [ordinal, imageId] of ((input as ImageEditInput).imageIds || []).entries()) {
            await tx.imageTaskInput.create({
              data: {
                taskId: imageTask.id,
                imageId,
                ordinal
              }
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
              sub2apiRequestId: this.extractUpstreamRequestId(upstream) || requestId
            }
          })
        })
      }
      await this.sub2api.ingestCompletionUsage({
        requestId,
        sub2apiRequestId: this.extractUpstreamRequestId(upstream) || requestId,
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
        data: { status: 'failed', errorMessage: error instanceof Error ? error.message : String(error), completedAt: new Date() }
      })
      if (imageTask) {
        await this.prisma.imageTask.update({
          where: { id: imageTask.id },
          data: { status: 'failed', error: error instanceof Error ? error.message : String(error), finishedAt: new Date() }
        }).catch(() => undefined)
      }
      throw error
    }
  }

  private validateImageParams(input: ImageGenerateInput | ImageEditInput) {
    if (input.size && input.size !== 'auto' && !/^\d{2,4}x\d{2,4}$/i.test(input.size))
      throw new BadRequestException('invalid_size')
    if (input.size && input.size !== 'auto') {
      const [w, h] = input.size.split('x').map((n) => Number(n))
      if (!w || !h || w < 256 || h < 256 || w > 4096 || h > 4096 || w % 16 !== 0 || h % 16 !== 0)
        throw new BadRequestException('invalid_size')
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
    if (input.n != null) {
      const n = Number(input.n)
      if (!Number.isInteger(n) || n < 1 || n > 8) throw new BadRequestException('invalid_n')
    }
  }

  private validateReferenceImages(input: ImageEditInput) {
    let totalBytes = 0
    for (const dataUrl of input.images || []) {
      const decoded = this.decodeReferenceImage(dataUrl)
      totalBytes += decoded.buffer.length
      if (decoded.buffer.length > MAX_REFERENCE_IMAGE_BYTES) {
        throw new BadRequestException('reference_image_too_large')
      }
      if (totalBytes > MAX_REFERENCE_IMAGES_TOTAL_BYTES) {
        throw new BadRequestException('reference_image_too_large')
      }
    }
  }

  private referenceImageCount(input: ImageEditInput) {
    return (input.images || []).length + (input.imageIds || []).length
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

  private async persistImagesIfEnabled(userId: string, images: string[], fallbackMime: string, requestId: string): Promise<PersistedImageResult[]> {
    if (this.config.get<string>('IMAGE_BACKEND') !== 'minio') return images.map((url) => ({ url }))

    const persisted: PersistedImageResult[] = []
    for (const image of images) {
      const decoded = await this.imageToBuffer(image, fallbackMime)
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
            n: input.n || 1,
            size: input.size || '1024x1024',
            quality: input.quality || 'medium',
            output_format: outputFormat,
            output_compression:
              outputFormat !== 'png'
                ? input.output_compression
                : undefined,
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
    form.set('n', String(input.n || 1))
    form.set('size', input.size || '1024x1024')
    form.set('quality', input.quality || 'medium')
    form.set('output_format', outputFormat)
    if (
      input.output_compression != null &&
      outputFormat !== 'png'
    ) {
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

  private titleFromMessages(messages: ChatMessageInput[]) {
    const first = messages.find((message) => message.role === 'user')?.content?.trim()
    if (!first) return '新对话'
    return first.slice(0, 24)
  }

  private writeSse(res: Response, event: string, data: unknown) {
    res.write(`event: ${event}\n`)
    res.write(`data: ${JSON.stringify(data)}\n\n`)
  }

  private extractUpstreamRequestId(res: globalThis.Response) {
    for (const header of ['x-request-id', 'x-sub2api-request-id', 'openai-request-id']) {
      const value = res.headers.get(header)
      if (value) return value
    }
    return ''
  }

  private gatewayKeyForRequest(requestId: string) {
    const keys = (this.config.get<string>('SUB2API_GATEWAY_API_KEYS') || '')
      .split(',')
      .map((key) => key.trim())
      .filter(Boolean)
    const fallback = this.config.get<string>('SUB2API_GATEWAY_API_KEY')
    if (fallback) keys.push(fallback)
    if (keys.length === 0) return ''

    // Keep selection deterministic per request so retries use the same upstream key.
    const index = [...requestId].reduce((sum, char) => sum + char.charCodeAt(0), 0) % keys.length
    return keys[index]
  }

  private async readJson(res: globalThis.Response) {
    const text = await res.text().catch(() => '')
    if (!text) return null
    try {
      return JSON.parse(text) as unknown
    } catch {
      return text
    }
  }

  private upstreamErrorMessage(data: unknown, status: number) {
    if (data && typeof data === 'object') {
      const obj = data as Record<string, unknown>
      const error = obj.error
      if (error && typeof error === 'object') {
        const message = (error as Record<string, unknown>).message
        if (typeof message === 'string' && message) return message
      }
      const message = obj.message
      if (typeof message === 'string' && message) return message
    }
    return `sub2api_http_${status}`
  }

  private asImageGenerationResponse(data: unknown): ImageGenerationResponse {
    if (data && typeof data === 'object') return data as ImageGenerationResponse
    return {}
  }
}
