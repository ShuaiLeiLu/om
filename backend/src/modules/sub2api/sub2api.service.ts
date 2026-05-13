import { Injectable } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { ConfigService } from '@nestjs/config'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { QuotaService } from '../quota/quota.service'

type RawUsage = Record<string, unknown> & {
  id?: string
  usage_id?: string
  request_id?: string
  requestId?: string
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
  sub2apiUsageId: string
  requestId: string
  model?: string
  promptTokens: bigint
  completionTokens: bigint
  totalTokens: bigint
  cost: Prisma.Decimal
  createdAt?: Date
  raw: RawUsage
}

type UsagePage = {
  usages: RawUsage[]
  nextCursor: string | null
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
    try {
      const baseUrl = this.config.get<string>('SUB2API_BASE_URL')
      const adminToken = this.config.get<string>('SUB2API_ADMIN_API_KEY') || this.config.get<string>('SUB2API_ADMIN_TOKEN')
      const adminEmail = this.config.get<string>('SUB2API_ADMIN_EMAIL')
      const adminPassword = this.config.get<string>('SUB2API_ADMIN_PASSWORD')
      if (!baseUrl || (!adminToken && (!adminEmail || !adminPassword))) {
        return this.syncFailed('sub2api_admin_config_incomplete')
      }

      const state = await this.prisma.syncState.upsert({
        where: { name: 'sub2api_usage' },
        create: { name: 'sub2api_usage' },
        update: {}
      })
      const token = adminToken || await this.loginAdmin(baseUrl, String(adminEmail), String(adminPassword))
      let cursor = state.cursor || undefined
      let synced = 0
      let duplicated = 0
      let pages = 0
      const maxPages = Math.max(1, Number(this.config.get<string>('SUB2API_USAGE_SYNC_MAX_PAGES') || 5))

      while (pages < maxPages) {
        const page = await this.fetchUsagePage(baseUrl, token, cursor)
        pages += 1
        for (const raw of page.usages) {
          const result = await this.ingestUsage(raw)
          if (result.ok && 'duplicated' in result && result.duplicated) duplicated += 1
          else if (result.ok) synced += 1
        }
        cursor = page.nextCursor || undefined
        if (!cursor || page.usages.length === 0) break
      }

      await this.prisma.syncState.upsert({
        where: { name: 'sub2api_usage' },
        create: { name: 'sub2api_usage', cursor: cursor || null, lastSuccessAt: new Date(), lastError: null },
        update: { cursor: cursor || state.cursor, lastSuccessAt: new Date(), lastError: null }
      })
      return { ok: true, synced, duplicated, pages, cursor: cursor || null }
    } catch (error) {
      return this.syncFailed(error instanceof Error ? error.message : String(error))
    }
  }

  async ingestUsage(raw: RawUsage) {
    const usage = this.normalizeUsage(raw)
    if (!usage) return { ok: false, reason: 'usage_id_required' }

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.usageEvent.findUnique({ where: { sub2apiUsageId: usage.sub2apiUsageId } })
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
      if (request) {
        const chargedForRequest = await tx.usageEvent.findFirst({
          where: { llmRequestId: request.id, status: 'charged' }
        })
        if (chargedForRequest) {
          const ignored = await tx.usageEvent.create({
            data: {
              sub2apiUsageId: usage.sub2apiUsageId,
              llmRequestId: request.id,
              userId: request.userId,
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
          sub2apiUsageId: usage.sub2apiUsageId,
          llmRequestId: request?.id,
          userId: request?.userId,
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

      if (request?.userId && usage.totalTokens > BigInt(0)) {
        await this.quota.consumeTokensInTransaction(tx, request.userId, usage.totalTokens, event.id)
        await tx.usageEvent.update({ where: { id: event.id }, data: { status: 'charged' } })
      }
      return { ok: true, usageId: event.id, charged: Boolean(request?.userId && usage.totalTokens > BigInt(0)) }
    })
  }

  async ingestCompletionUsage(input: {
    requestId: string
    sub2apiRequestId?: string
    model?: string
    usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number; promptTokens?: number; completionTokens?: number; totalTokens?: number }
    raw?: Record<string, unknown>
  }) {
    if (!input.usage) return { ok: false, skipped: true, reason: 'usage_missing' }
    const sub2apiUsageId = input.sub2apiRequestId || input.requestId
    return this.ingestUsage({
      id: sub2apiUsageId,
      request_id: input.sub2apiRequestId || input.requestId,
      local_request_id: input.requestId,
      model: input.model,
      prompt_tokens: input.usage.prompt_tokens ?? input.usage.promptTokens,
      completion_tokens: input.usage.completion_tokens ?? input.usage.completionTokens,
      total_tokens: input.usage.total_tokens ?? input.usage.totalTokens,
      ...(input.raw || {})
    })
  }

  status() {
    return this.prisma.syncState.findUnique({ where: { name: 'sub2api_usage' } })
  }

  events() {
    return this.prisma.usageEvent.findMany({ orderBy: { createdAt: 'desc' }, take: 200 })
  }

  private async loginAdmin(baseUrl: string, email: string, password: string) {
    const endpoint = this.config.get<string>('SUB2API_ADMIN_LOGIN_PATH') || '/api/admin/login'
    const res = await fetch(this.absoluteUrl(baseUrl, endpoint), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, username: email, password }),
      signal: AbortSignal.timeout(10000)
    })
    const data = await this.readJson(res)
    if (!res.ok) throw new Error(`sub2api_admin_login_failed_${res.status}${this.errorSuffix(data)}`)
    const token = this.pickToken(data)
    if (!token) throw new Error('sub2api_admin_token_missing')
    return token
  }

  private async fetchUsagePage(baseUrl: string, token: string, cursor?: string): Promise<UsagePage> {
    const endpoint = this.config.get<string>('SUB2API_USAGE_PATH') || '/api/admin/usage'
    const url = new URL(this.absoluteUrl(baseUrl, endpoint))
    if (cursor) url.searchParams.set('cursor', cursor)
    url.searchParams.set('limit', this.config.get<string>('SUB2API_USAGE_PAGE_SIZE') || '100')
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(20000)
    })
    const data = await this.readJson(res)
    if (!res.ok) throw new Error(`sub2api_usage_http_${res.status}${this.errorSuffix(data)}`)
    return {
      usages: this.extractUsageArray(data),
      nextCursor: this.pickString(data, ['nextCursor', 'next_cursor', 'cursor']) || null
    }
  }

  private normalizeUsage(raw: RawUsage): NormalizedUsage | null {
    const requestId = this.firstString(raw.request_id, raw.requestId, raw.local_request_id)
    const sub2apiUsageId = this.firstString(raw.id, raw.usage_id, raw.usageId, requestId)
    if (!sub2apiUsageId) return null
    const promptTokens = this.bigintFrom(raw.prompt_tokens ?? raw.promptTokens)
    const completionTokens = this.bigintFrom(raw.completion_tokens ?? raw.completionTokens)
    const providedTotal = this.bigintFrom(raw.total_tokens ?? raw.totalTokens)
    const totalTokens = providedTotal > BigInt(0) ? providedTotal : promptTokens + completionTokens
    const createdAtValue = this.firstString(raw.created_at, raw.createdAt)
    return {
      sub2apiUsageId,
      requestId,
      model: this.firstString(raw.model),
      promptTokens,
      completionTokens,
      totalTokens,
      cost: new Prisma.Decimal(String(raw.cost ?? 0)),
      createdAt: createdAtValue ? new Date(createdAtValue) : undefined,
      raw
    }
  }

  private extractUsageArray(data: unknown): RawUsage[] {
    if (Array.isArray(data)) return data as RawUsage[]
    if (!data || typeof data !== 'object') return []
    const obj = data as Record<string, unknown>
    for (const key of ['data', 'items', 'records', 'usages', 'usage']) {
      const value = obj[key]
      if (Array.isArray(value)) return value as RawUsage[]
    }
    return []
  }

  private pickString(data: unknown, keys: string[]) {
    if (!data || typeof data !== 'object') return ''
    const obj = data as Record<string, unknown>
    for (const key of keys) {
      const value = obj[key]
      if (typeof value === 'string' && value.trim()) return value.trim()
      if (typeof value === 'number') return String(value)
    }
    return ''
  }

  private pickToken(data: unknown) {
    const keys = ['token', 'access_token', 'accessToken', 'jwt', 'admin_api_key', 'adminApiKey']
    const direct = this.pickString(data, keys)
    if (direct) return direct
    if (!data || typeof data !== 'object') return ''
    return this.pickString((data as Record<string, unknown>).data, keys)
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

  private async readJson(res: Response) {
    const text = await res.text()
    if (!text) return null
    try {
      return JSON.parse(text)
    } catch {
      return { raw: text }
    }
  }

  private absoluteUrl(baseUrl: string, path: string) {
    if (/^https?:\/\//i.test(path)) return path
    return `${baseUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}`
  }

  private async syncFailed(reason: string) {
    await this.prisma.syncState.upsert({
      where: { name: 'sub2api_usage' },
      create: { name: 'sub2api_usage', lastError: reason },
      update: { lastError: reason }
    })
    return { ok: false, skipped: true, reason }
  }

  private errorSuffix(data: unknown) {
    const reason = this.pickString(data, ['reason', 'code', 'message', 'error'])
    return reason ? `_${reason}` : ''
  }
}
