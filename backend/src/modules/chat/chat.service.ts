import { BadRequestException, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Response } from 'express'
import { randomToken } from '../../common/http'
import { ModelsService } from '../models/models.service'
import { PointsService } from '../points/points.service'
import { PrismaService } from '../prisma/prisma.service'
import { Sub2apiService } from '../sub2api/sub2api.service'
import {
  StreamUsage,
  chatUpstreamErrorMessage,
  extractUpstreamRequestId,
  gatewayKeyForRequest,
  readJsonBody,
  writeSse
} from './chat.util'

// Re-export image input types from the new service so existing imports keep working.
export type { ImageGenerateInput, ImageEditInput } from './chat-image.service'

type ChatMessageInput = {
  role: 'user' | 'assistant' | 'system'
  content: string
  images?: string[]
}

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly points: PointsService,
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
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, userId }
    })
    if (!conversation) throw new BadRequestException('conversation_not_found')
    return this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' }
    })
  }

  async streamCompletion(
    userId: string,
    input: { conversationId?: string; model: string; messages: ChatMessageInput[] },
    res: Response
  ) {
    const balance = await this.points.balance(userId)
    if (balance <= BigInt(0)) throw new BadRequestException('points_insufficient')
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

    writeSse(res, 'message.meta', { requestId, conversationId: conversation.id })
    let assistantContent = ''
    try {
      const sub2apiBaseUrl = this.config.get<string>('SUB2API_BASE_URL') || ''
      const gatewayKey = gatewayKeyForRequest(this.config, requestId)
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
          user: userId,
          stream: true,
          stream_options: { include_usage: true }
        }),
        signal: AbortSignal.timeout(120000)
      })
      if (!upstream.ok) {
        const data = await readJsonBody(upstream)
        throw new Error(chatUpstreamErrorMessage(data, upstream.status))
      }
      if (!upstream.body) throw new Error('上游模型服务没有返回流式内容，请稍后重试')
      const sub2apiRequestId = extractUpstreamRequestId(upstream) || requestId
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
          const parsed = JSON.parse(payload) as {
            choices?: Array<{ delta?: { content?: string } }>
            usage?: StreamUsage
          }
          if (parsed.usage) usage = parsed.usage
          const delta = parsed.choices?.[0]?.delta?.content || ''
          if (delta) {
            assistantContent += delta
            writeSse(res, 'message.delta', { content: delta })
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
      writeSse(res, 'message.done', { requestId, conversationId: conversation.id, usage: usageResult })
    } catch (error) {
      await this.prisma.llmRequest.update({
        where: { id: llmRequest.id },
        data: {
          status: 'failed',
          errorMessage: error instanceof Error ? error.message : String(error),
          completedAt: new Date()
        }
      })
      writeSse(res, 'message.error', { error: error instanceof Error ? error.message : 'chat_failed' })
    } finally {
      res.end()
    }
  }

  private titleFromMessages(messages: ChatMessageInput[]) {
    const first = messages.find((message) => message.role === 'user')?.content?.trim()
    if (!first) return '新对话'
    return first.slice(0, 24)
  }
}
