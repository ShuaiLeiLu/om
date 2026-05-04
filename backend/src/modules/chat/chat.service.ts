import { BadRequestException, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Response } from 'express'
import { randomToken } from '../../common/http'
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

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly quota: QuotaService,
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
      const gatewayKey = this.config.get<string>('SUB2API_GATEWAY_API_KEY') || ''
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

  async generateImage(userId: string, input: { conversationId?: string; model: string; prompt: string; size?: string; n?: number }) {
    const prompt = input.prompt.trim()
    if (!prompt) throw new BadRequestException('prompt_required')

    const balance = await this.quota.balance(userId)
    if (balance <= BigInt(0)) throw new BadRequestException('token_insufficient')
    const model = await this.models.assertEnabled(input.model)
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

    try {
      const sub2apiBaseUrl = this.config.get<string>('SUB2API_BASE_URL') || ''
      const gatewayKey = this.config.get<string>('SUB2API_GATEWAY_API_KEY') || ''
      if (!sub2apiBaseUrl || !gatewayKey) throw new BadRequestException('sub2api_config_incomplete')

      const upstream = await fetch(`${sub2apiBaseUrl.replace(/\/$/, '')}/v1/images/generations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${gatewayKey}`,
          'X-Chatty-Request-Id': requestId
        },
        body: JSON.stringify({
          model: model.sub2apiModel,
          prompt,
          n: input.n || 1,
          size: input.size || '1024x1024'
        }),
        signal: AbortSignal.timeout(180000)
      })
      const data = this.asImageGenerationResponse(await this.readJson(upstream))
      if (!upstream.ok) throw new Error(this.upstreamErrorMessage(data, upstream.status))

      const images = (data.data || [])
        .map((item) => item.url || (item.b64_json ? `data:image/png;base64,${item.b64_json}` : ''))
        .filter(Boolean)
      if (images.length === 0) throw new Error('image_generation_empty')

      const revisedPrompts = (data.data || [])
        .map((item) => item.revised_prompt)
        .filter((value): value is string => Boolean(value))
      const assistantContent = revisedPrompts[0] ? `生成图片：${revisedPrompts[0]}` : '图片已生成'
      if (conversation) {
        await this.prisma.message.create({
          data: {
            conversationId: conversation.id,
            userId,
            role: 'assistant',
            content: assistantContent,
            imagesJson: images,
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
      await this.sub2api.ingestCompletionUsage({
        requestId,
        sub2apiRequestId: this.extractUpstreamRequestId(upstream) || requestId,
        model: model.sub2apiModel,
        usage: data.usage,
        raw: { source: 'image_generation' }
      })
      return { requestId, conversationId: conversation?.id || null, content: assistantContent, images }
    } catch (error) {
      await this.prisma.llmRequest.update({
        where: { id: llmRequest.id },
        data: { status: 'failed', errorMessage: error instanceof Error ? error.message : String(error), completedAt: new Date() }
      })
      throw error
    }
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
