import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Prisma } from '@prisma/client'
import * as argon2 from 'argon2'
import { Response } from 'express'
import { randomToken, sha256, toPublicBigInt } from '../../common/http'
import { PrismaService } from '../prisma/prisma.service'

const ADMIN_COOKIE = 'chatty_admin_session'

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
    const admin = await this.prisma.adminUser.findFirst({
      where: { OR: [{ username: login }, { email: login }] }
    })
    if (!admin || admin.status !== 'active') throw new UnauthorizedException('invalid_credentials')
    const ok = await argon2.verify(admin.passwordHash, password)
    if (!ok) throw new UnauthorizedException('invalid_credentials')

    const token = randomToken()
    const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
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
    const [users, requests, tokenLedger, adLedger] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.llmRequest.count(),
      this.prisma.quotaLedger.aggregate({ _sum: { deltaTokens: true } }),
      this.prisma.quotaLedger.aggregate({ where: { type: 'ad_reward' }, _sum: { deltaTokens: true } })
    ])
    return {
      users,
      llmRequests: requests,
      totalTokenDelta: toPublicBigInt(tokenLedger._sum.deltaTokens || 0),
      adRewardTokens: toPublicBigInt(adLedger._sum.deltaTokens || 0)
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

  async adjustQuota(adminId: string, userId: string, input: { tokens?: string | number; validDays?: number; remark?: string }) {
    const tokens = BigInt(input.tokens || 0)
    const validDays = Math.max(1, Number(input.validDays || 30))
    if (tokens === BigInt(0)) throw new BadRequestException('tokens_required')
    const expiresAt = new Date(Date.now() + validDays * 24 * 60 * 60 * 1000)
    const result = await this.prisma.$transaction(async (tx) => {
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

  private cookieOptions(expiresAt: Date) {
    const isProd = this.config.get<string>('NODE_ENV') === 'production'
    return { httpOnly: true, secure: isProd, sameSite: 'lax' as const, path: '/', expires: expiresAt }
  }
}
