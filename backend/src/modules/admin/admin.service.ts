import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { LlmRequestStatus, Prisma, QuotaLedgerType } from '@prisma/client'
import * as argon2 from 'argon2'
import { Response } from 'express'
import { randomToken, sha256, toPublicBigInt } from '../../common/http'
import { PrismaService } from '../prisma/prisma.service'

const ADMIN_COOKIE = 'chatty_admin_session'
const DAY_MS = 24 * 60 * 60 * 1000

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService
  ) {}

  async login(input: { username?: string; email?: string; password?: string }, res: Response, meta: { ip: string; userAgent: string }) {
    const login = String(input.username || input.email || '').trim()
    const password = String(input.password || '')
    if (!login || !password) throw new BadRequestException('username_password_required')
    return this.loginWithIdentifier(login, password, res, meta)
  }

  async tryLoginWithIdentifier(login: string, password: string, res: Response, meta: { ip: string; userAgent: string }) {
    if (!login || !password) return null
    const admin = await this.prisma.adminUser.findFirst({
      where: { OR: [{ username: login }, { email: login.toLowerCase() }] }
    })
    if (!admin || admin.status !== 'active') return null
    const ok = await argon2.verify(admin.passwordHash, password)
    if (!ok) return null

    return this.createAdminSession(admin, res, meta)
  }

  private async loginWithIdentifier(login: string, password: string, res: Response, meta: { ip: string; userAgent: string }) {
    const admin = await this.prisma.adminUser.findFirst({
      where: { OR: [{ username: login }, { email: login.toLowerCase() }] }
    })
    if (!admin || admin.status !== 'active') throw new UnauthorizedException('invalid_credentials')
    const ok = await argon2.verify(admin.passwordHash, password)
    if (!ok) throw new UnauthorizedException('invalid_credentials')

    return this.createAdminSession(admin, res, meta)
  }

  private async createAdminSession(
    admin: { id: string; username: string; role: string },
    res: Response,
    meta: { ip: string; userAgent: string }
  ) {
    const token = randomToken()
    const expiresAt = new Date(Date.now() + 14 * DAY_MS)
    await this.prisma.adminSession.create({
      data: { adminUserId: admin.id, refreshTokenHash: sha256(token), expiresAt, ip: meta.ip, userAgent: meta.userAgent }
    })
    await this.prisma.adminUser.update({ where: { id: admin.id }, data: { lastLoginAt: new Date() } })
    res.cookie(ADMIN_COOKIE, token, this.cookieOptions(expiresAt))
    await this.audit(admin.id, 'admin_login', 'admin_user', admin.id, null, { ip: meta.ip })
    return { id: admin.id, username: admin.username, role: admin.role, expiresAt }
  }

  async logout(token: string | undefined, res: Response) {
    if (token) {
      await this.prisma.adminSession.updateMany({
        where: { refreshTokenHash: sha256(token), status: 'active' },
        data: { status: 'revoked', revokedAt: new Date() }
      })
    }
    res.clearCookie(ADMIN_COOKIE, { path: '/' })
    return { ok: true }
  }

  me(adminId: string) {
    return this.prisma.adminUser.findUnique({
      where: { id: adminId },
      select: { id: true, username: true, email: true, role: true, status: true }
    })
  }

  async dashboard() {
    const since = new Date(Date.now() - 7 * DAY_MS)
    const [
      users,
      activeUsers,
      newUsers7d,
      requests,
      completedRequests,
      failedRequests,
      requests7d,
      imageTasks,
      imageTasks7d,
      conversations,
      tokenLedger,
      usageLedger,
      adLedger,
      storageUsage
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { status: 'active' } }),
      this.prisma.user.count({ where: { createdAt: { gte: since } } }),
      this.prisma.llmRequest.count(),
      this.prisma.llmRequest.count({ where: { status: 'completed' } }),
      this.prisma.llmRequest.count({ where: { status: 'failed' } }),
      this.prisma.llmRequest.count({ where: { createdAt: { gte: since } } }),
      this.prisma.imageTask.count(),
      this.prisma.imageTask.count({ where: { createdAt: { gte: since } } }),
      this.prisma.conversation.count({ where: { status: 'active' } }),
      this.prisma.quotaLedger.aggregate({ _sum: { deltaTokens: true } }),
      this.prisma.quotaLedger.aggregate({ where: { type: 'model_usage' }, _sum: { deltaTokens: true } }),
      this.prisma.quotaLedger.aggregate({ where: { type: 'ad_reward' }, _sum: { deltaTokens: true } })
      ,
      this.prisma.storageUsage.aggregate({ _sum: { bytesTotal: true, imagesCount: true } })
    ])
    return {
      users,
      activeUsers,
      newUsers7d,
      llmRequests: requests,
      completedRequests,
      failedRequests,
      requests7d,
      imageTasks,
      imageTasks7d,
      conversations,
      totalTokenDelta: toPublicBigInt(tokenLedger._sum.deltaTokens || 0),
      modelUsageTokens: toPublicBigInt(usageLedger._sum.deltaTokens || 0),
      adRewardTokens: toPublicBigInt(adLedger._sum.deltaTokens || 0),
      storageBytes: toPublicBigInt(storageUsage._sum.bytesTotal || 0),
      storedImages: storageUsage._sum.imagesCount || 0
    }
  }

  listUsers(query: { q?: string; status?: string; page?: string; pageSize?: string }) {
    const page = Math.max(1, Number(query.page || 1))
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize || 20)))
    const where: Prisma.UserWhereInput = {}
    if (query.status === 'active' || query.status === 'disabled') where.status = query.status
    if (query.q) {
      where.OR = [
        { displayName: { contains: query.q, mode: 'insensitive' } },
        { oauthAccounts: { some: { openid: { contains: query.q } } } }
      ]
    }
    return this.prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { oauthAccounts: true }
    })
  }

  async updateUserStatus(adminId: string, userId: string, status: 'active' | 'disabled') {
    const before = await this.prisma.user.findUnique({ where: { id: userId } })
    const user = await this.prisma.user.update({ where: { id: userId }, data: { status } })
    if (status === 'disabled') {
      await this.prisma.userSession.updateMany({ where: { userId }, data: { status: 'revoked', revokedAt: new Date() } })
    }
    await this.audit(adminId, `user_${status}`, 'user', userId, before, user)
    return user
  }

  async deleteUser(adminId: string, userId: string) {
    const before = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { oauthAccounts: true }
    })
    if (!before) throw new BadRequestException('user_not_found')

    await this.prisma.$transaction(async (tx) => {
      await tx.userSession.updateMany({
        where: { userId },
        data: { status: 'revoked', revokedAt: new Date() }
      })
      await tx.imageTask.deleteMany({ where: { userId } })
      await tx.user.delete({ where: { id: userId } })
    })
    await this.audit(adminId, 'user_delete', 'user', userId, before, null)
    return { ok: true, id: userId }
  }

  async adjustQuota(adminId: string, userId: string, input: { tokens?: string | number; validDays?: number; remark?: string }) {
    const tokens = BigInt(input.tokens || 0)
    const validDays = Math.max(1, Number(input.validDays || 30))
    if (tokens === BigInt(0)) throw new BadRequestException('tokens_required')
    const expiresAt = new Date(Date.now() + validDays * 24 * 60 * 60 * 1000)
    const result = await this.prisma.$transaction(async (tx) => {
      if (tokens < BigInt(0)) {
        let remaining = -tokens
        const grants = await tx.tokenGrant.findMany({
          where: { userId, status: 'active', remainingTokens: { gt: 0 }, expiresAt: { gt: new Date() } },
          orderBy: [{ expiresAt: 'asc' }, { createdAt: 'asc' }]
        })
        for (const grant of grants) {
          if (remaining <= BigInt(0)) break
          const deduct = grant.remainingTokens < remaining ? grant.remainingTokens : remaining
          remaining -= deduct
          await tx.tokenGrant.update({
            where: { id: grant.id },
            data: {
              remainingTokens: grant.remainingTokens - deduct,
              status: grant.remainingTokens - deduct === BigInt(0) ? 'exhausted' : grant.status
            }
          })
        }
        if (remaining > BigInt(0)) throw new BadRequestException('token_insufficient')
        const balance = await this.balance(tx, userId)
        const ledger = await tx.quotaLedger.create({
          data: {
            userId,
            type: 'manual_adjustment',
            deltaTokens: tokens,
            balanceAfter: balance,
            relatedId: adminId,
            remark: input.remark || ''
          }
        })
        return { grant: null, ledger, balance }
      }

      const grant = await tx.tokenGrant.create({
        data: {
          userId,
          source: 'manual_adjustment',
          sourceId: adminId,
          totalTokens: tokens,
          remainingTokens: tokens,
          expiresAt
        }
      })
      const balance = await this.balance(tx, userId)
      const ledger = await tx.quotaLedger.create({
        data: {
          userId,
          grantId: grant.id,
          type: 'manual_adjustment',
          deltaTokens: tokens,
          balanceAfter: balance,
          relatedId: adminId,
          remark: input.remark || ''
        }
      })
      return { grant, ledger, balance }
    })
    await this.audit(adminId, 'quota_adjust', 'user', userId, null, { tokens: tokens.toString() })
    return { ...result, balance: result.balance.toString() }
  }

  listLlmRequests(query: { userId?: string; status?: string; page?: string; pageSize?: string }) {
    const { page, pageSize } = this.pagination(query)
    const where: Prisma.LlmRequestWhereInput = {}
    if (query.userId) where.userId = query.userId
    if (this.isLlmRequestStatus(query.status)) where.status = query.status
    return this.prisma.llmRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { user: true, conversation: true, usageEvents: true }
    })
  }

  listQuotaLedger(query: { userId?: string; type?: string; page?: string; pageSize?: string }) {
    const { page, pageSize } = this.pagination(query)
    const where: Prisma.QuotaLedgerWhereInput = {}
    if (query.userId) where.userId = query.userId
    if (this.isQuotaLedgerType(query.type)) where.type = query.type
    return this.prisma.quotaLedger.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { user: true, grant: true }
    })
  }

  listAuditLogs(query: { adminUserId?: string; action?: string; page?: string; pageSize?: string }) {
    const { page, pageSize } = this.pagination(query)
    const where: Prisma.AdminAuditLogWhereInput = {}
    if (query.adminUserId) where.adminUserId = query.adminUserId
    if (query.action) where.action = query.action
    return this.prisma.adminAuditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { adminUser: true }
    })
  }

  listWechatAccounts(query: { q?: string; page?: string; pageSize?: string }) {
    const { page, pageSize } = this.pagination(query)
    const where: Prisma.OauthAccountWhereInput = { provider: 'wechat_miniapp' }
    if (query.q) {
      where.OR = [
        { openid: { contains: query.q } },
        { unionid: { contains: query.q } },
        { nickname: { contains: query.q, mode: 'insensitive' } },
        { user: { displayName: { contains: query.q, mode: 'insensitive' } } }
      ]
    }
    return this.prisma.oauthAccount.findMany({
      where,
      orderBy: { boundAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { user: true }
    })
  }

  async unbindWechatAccount(adminId: string, accountId: string) {
    const before = await this.prisma.oauthAccount.findUnique({ where: { id: accountId } })
    if (!before || before.provider !== 'wechat_miniapp') throw new BadRequestException('wechat_account_not_found')
    await this.prisma.$transaction(async (tx) => {
      await tx.oauthAccount.delete({ where: { id: accountId } })
      await tx.wechatMiniappSession.updateMany({
        where: { openid: before.openid },
        data: { userId: null, revokedAt: new Date() }
      })
    })
    await this.audit(adminId, 'wechat_unbind', 'oauth_account', accountId, before, null)
    return { ok: true }
  }

  async audit(adminUserId: string | null, action: string, targetType: string, targetId: string | null, before: unknown, after: unknown) {
    await this.prisma.adminAuditLog.create({
      data: {
        adminUserId,
        action,
        targetType,
        targetId,
        beforeJson: before === null ? undefined : JSON.parse(JSON.stringify(before)),
        afterJson: after === null ? undefined : JSON.parse(JSON.stringify(after))
      }
    })
  }

  private async balance(tx: Prisma.TransactionClient, userId: string) {
    const grants = await tx.tokenGrant.findMany({
      where: { userId, status: 'active', expiresAt: { gt: new Date() } },
      select: { remainingTokens: true }
    })
    return grants.reduce((sum, grant) => sum + grant.remainingTokens, BigInt(0))
  }

  private pagination(query: { page?: string; pageSize?: string }) {
    return {
      page: Math.max(1, Number(query.page || 1)),
      pageSize: Math.min(100, Math.max(1, Number(query.pageSize || 20)))
    }
  }

  private isLlmRequestStatus(status?: string): status is LlmRequestStatus {
    return ['pending', 'streaming', 'completed', 'failed', 'cancelled'].includes(String(status || ''))
  }

  private isQuotaLedgerType(type?: string): type is QuotaLedgerType {
    return ['redeem_code', 'ad_reward', 'manual_adjustment', 'model_usage', 'grant_expired', 'refund'].includes(String(type || ''))
  }

  private cookieOptions(expiresAt: Date) {
    const isProd = this.config.get<string>('NODE_ENV') === 'production'
    return { httpOnly: true, secure: isProd, sameSite: 'lax' as const, path: '/', expires: expiresAt }
  }
}
