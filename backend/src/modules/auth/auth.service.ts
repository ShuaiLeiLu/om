import { Injectable, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Response } from 'express'
import { PrismaService } from '../prisma/prisma.service'
import { randomToken, sha256 } from '../../common/http'

const USER_COOKIE = 'chatty_session'

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService
  ) {}

  async createUserSession(userId: string, res: Response, meta: { ip: string; userAgent: string }) {
    const token = randomToken()
    const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
    await this.prisma.userSession.create({
      data: { userId, refreshTokenHash: sha256(token), expiresAt, ip: meta.ip, userAgent: meta.userAgent }
    })
    await this.prisma.user.update({ where: { id: userId }, data: { lastLoginAt: new Date() } })
    res.cookie(USER_COOKIE, token, this.cookieOptions(expiresAt))
    return { expiresAt }
  }

  async logout(token: string | undefined, res: Response) {
    if (token) {
      await this.prisma.userSession.updateMany({
        where: { refreshTokenHash: sha256(token), status: 'active' },
        data: { status: 'revoked', revokedAt: new Date() }
      })
    }
    res.clearCookie(USER_COOKIE, { path: '/' })
    return { ok: true }
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } })
    if (!user || user.status !== 'active') throw new UnauthorizedException('unauthorized')
    return { id: user.id, displayName: user.displayName, avatarUrl: user.avatarUrl, status: user.status }
  }

  private cookieOptions(expiresAt: Date) {
    const isProd = this.config.get<string>('NODE_ENV') === 'production'
    return {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax' as const,
      path: '/',
      expires: expiresAt
    }
  }
}
