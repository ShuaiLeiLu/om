import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PointsService } from '../points/points.service'
import { PrismaService } from '../prisma/prisma.service'

type RawUsage = Record<string, unknown> & {
  id?: string
  usage_id?: string
  request_id?: string
  requestId?: string
  user?: string
  user_id?: string
  userId?: string
  model?: string
  prompt_tokens?: number
  promptTokens?: number
  completion_tokens?: number
  completionTokens?: number
  total_tokens?: number
  totalTokens?: number
  cost?: number | string
  created_at?: string
  createdAt?: string
}

type NormalizedUsage = {
  usageKey: string
  requestId: string
  userId: string
  model?: string
  promptTokens: bigint
  completionTokens: bigint
  totalTokens: bigint
  cost: Prisma.Decimal
  createdAt?: Date
  raw: RawUsage
}

@Injectable()
export class Sub2apiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly points: PointsService
  ) {}

  async ingestUsage(raw: RawUsage) {
    const usage = this.normalizeUsage(raw)
    if (!usage) return { ok: false, reason: 'usage_id_required' }

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.usageEvent.findUnique({ where: { usageKey: usage.usageKey } })
      if (existing) return { ok: true, duplicated: true, usageId: existing.id }

      const request = usage.requestId
        ? await tx.llmRequest.findFirst({
            where: {
              OR: [
                { requestId: usage.requestId },
                { sub2apiRequestId: usage.requestId }
              ]
            }
          })
        : null
      const fallbackUserId = request?.userId || usage.userId || undefined
      if (request) {
        const chargedForRequest = await tx.usageEvent.findFirst({
          where: { llmRequestId: request.id, status: 'charged' }
        })
        if (chargedForRequest) {
          const ignored = await tx.usageEvent.create({
            data: {
              usageKey: usage.usageKey,
              llmRequestId: request.id,
              userId: fallbackUserId,
              modelId: usage.model || request.modelId,
              promptTokens: usage.promptTokens,
              completionTokens: usage.completionTokens,
              totalTokens: usage.totalTokens,
              cost: usage.cost,
              rawJson: this.toJsonValue(usage.raw),
              syncedAt: usage.createdAt || new Date(),
              status: 'ignored'
            }
          })
          return { ok: true, usageId: ignored.id, ignored: true, reason: 'request_already_charged' }
        }
      }
      const event = await tx.usageEvent.create({
        data: {
          usageKey: usage.usageKey,
          llmRequestId: request?.id,
          userId: fallbackUserId,
          modelId: usage.model || request?.modelId,
          promptTokens: usage.promptTokens,
          completionTokens: usage.completionTokens,
          totalTokens: usage.totalTokens,
          cost: usage.cost,
          rawJson: this.toJsonValue(usage.raw),
          syncedAt: usage.createdAt || new Date(),
          status: request ? 'matched' : 'unmatched'
        }
      })

      if (request?.userId) {
        const chargePoints = this.points.priceModelUsage({
          promptTokens: usage.promptTokens,
          completionTokens: usage.completionTokens,
          totalTokens: usage.totalTokens
        })
        await this.points.consumePointsInTransaction(
          tx,
          request.userId,
          chargePoints,
          event.id,
          `模型调用计费：${chargePoints.toString()} 积分`
        )
        await tx.usageEvent.update({ where: { id: event.id }, data: { status: 'charged' } })
      }
      return { ok: true, usageId: event.id, charged: Boolean(request?.userId) }
    })
  }

  async ingestCompletionUsage(input: {
    requestId: string
    sub2apiRequestId?: string
    model?: string
    usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number; promptTokens?: number; completionTokens?: number; totalTokens?: number }
    raw?: Record<string, unknown>
  }) {
    const usageKey = input.sub2apiRequestId || input.requestId
    return this.ingestUsage({
      id: usageKey,
      request_id: input.sub2apiRequestId || input.requestId,
      local_request_id: input.requestId,
      model: input.model,
      prompt_tokens: input.usage?.prompt_tokens ?? input.usage?.promptTokens,
      completion_tokens: input.usage?.completion_tokens ?? input.usage?.completionTokens,
      total_tokens: input.usage?.total_tokens ?? input.usage?.totalTokens,
      ...(input.raw || {})
    })
  }

  private normalizeUsage(raw: RawUsage): NormalizedUsage | null {
    const requestId = this.firstString(raw.request_id, raw.requestId, raw.local_request_id)
    const userId = this.firstString(raw.user, raw.user_id, raw.userId)
    const usageKey = this.firstString(raw.id, raw.usage_id, raw.usageId, requestId)
    if (!usageKey) return null
    const promptTokens = this.bigintFrom(raw.prompt_tokens ?? raw.promptTokens)
    const completionTokens = this.bigintFrom(raw.completion_tokens ?? raw.completionTokens)
    const providedTotal = this.bigintFrom(raw.total_tokens ?? raw.totalTokens)
    const totalTokens = providedTotal > BigInt(0) ? providedTotal : promptTokens + completionTokens
    const createdAtValue = this.firstString(raw.created_at, raw.createdAt)
    return {
      usageKey,
      requestId,
      userId,
      model: this.firstString(raw.model),
      promptTokens,
      completionTokens,
      totalTokens,
      cost: new Prisma.Decimal(String(raw.cost ?? 0)),
      createdAt: createdAtValue ? new Date(createdAtValue) : undefined,
      raw
    }
  }

  private firstString(...values: unknown[]) {
    for (const value of values) {
      if (typeof value === 'string' && value.trim()) return value.trim()
      if (typeof value === 'number') return String(value)
    }
    return ''
  }

  private bigintFrom(value: unknown) {
    if (typeof value === 'bigint') return value
    if (typeof value === 'number' && Number.isFinite(value)) return BigInt(Math.max(0, Math.trunc(value)))
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value)
      if (Number.isFinite(parsed)) return BigInt(Math.max(0, Math.trunc(parsed)))
    }
    return BigInt(0)
  }

  private toJsonValue(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value ?? {})) as Prisma.InputJsonValue
  }
}
