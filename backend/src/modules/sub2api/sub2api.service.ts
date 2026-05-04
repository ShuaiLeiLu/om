import { Injectable } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { ConfigService } from '@nestjs/config'
import { PrismaService } from '../prisma/prisma.service'
import { QuotaService } from '../quota/quota.service'

type RawUsage = {
  id?: string
  request_id?: string
  model?: string
  prompt_tokens?: number
  completion_tokens?: number
  total_tokens?: number
  cost?: number
  created_at?: string
}

@Injectable()
export class Sub2apiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly quota: QuotaService,
    private readonly config: ConfigService
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async scheduledSync() {
    const enabled = this.config.get<string>('SUB2API_USAGE_SYNC_DISABLED') !== 'true'
    if (!enabled) return
    await this.syncUsage().catch(async (error) => {
      await this.prisma.syncState.upsert({
        where: { name: 'sub2api_usage' },
        create: { name: 'sub2api_usage', lastError: error instanceof Error ? error.message : String(error) },
        update: { lastError: error instanceof Error ? error.message : String(error) }
      })
    })
  }

  async syncUsage() {
    const baseUrl = this.config.get<string>('SUB2API_BASE_URL')
    const adminEmail = this.config.get<string>('SUB2API_ADMIN_EMAIL')
    const adminPassword = this.config.get<string>('SUB2API_ADMIN_PASSWORD')
    if (!baseUrl || !adminEmail || !adminPassword) {
      return { ok: false, skipped: true, reason: 'sub2api_admin_config_incomplete' }
    }

    // Placeholder sync client: Sub2API endpoint shapes can vary by version.
    // This service records sync state and is ready for wiring to the concrete admin usage endpoint.
    await this.prisma.syncState.upsert({
      where: { name: 'sub2api_usage' },
      create: { name: 'sub2api_usage', lastSuccessAt: new Date(), cursor: null },
      update: { lastSuccessAt: new Date(), lastError: null }
    })
    return { ok: true, synced: 0 }
  }

  async ingestUsage(raw: RawUsage) {
    const sub2apiUsageId = raw.id || raw.request_id
    if (!sub2apiUsageId) return { ok: false, reason: 'usage_id_required' }
    const existing = await this.prisma.usageEvent.findUnique({ where: { sub2apiUsageId } })
    if (existing) return { ok: true, duplicated: true }
    const request = raw.request_id
      ? await this.prisma.llmRequest.findUnique({ where: { requestId: raw.request_id } })
      : null
    const usage = await this.prisma.usageEvent.create({
      data: {
        sub2apiUsageId,
        llmRequestId: request?.id,
        userId: request?.userId,
        modelId: raw.model || request?.modelId,
        promptTokens: BigInt(raw.prompt_tokens || 0),
        completionTokens: BigInt(raw.completion_tokens || 0),
        totalTokens: BigInt(raw.total_tokens || 0),
        cost: raw.cost || 0,
        rawJson: raw,
        status: request ? 'matched' : 'unmatched'
      }
    })
    if (request?.userId && usage.totalTokens > BigInt(0)) {
      await this.quota.consumeTokens(request.userId, usage.totalTokens, usage.id)
      await this.prisma.usageEvent.update({ where: { id: usage.id }, data: { status: 'charged' } })
    }
    return { ok: true, usageId: usage.id }
  }

  status() {
    return this.prisma.syncState.findUnique({ where: { name: 'sub2api_usage' } })
  }

  events() {
    return this.prisma.usageEvent.findMany({ orderBy: { createdAt: 'desc' }, take: 200 })
  }
}
