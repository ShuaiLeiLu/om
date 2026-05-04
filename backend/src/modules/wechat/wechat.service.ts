import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Response } from 'express'
import { AuthService } from '../auth/auth.service'
import { PrismaService } from '../prisma/prisma.service'
import { nowPlusSeconds, randomToken, sha256 } from '../../common/http'

type Code2SessionResponse = {
  openid?: string
  unionid?: string
  session_key?: string
  errcode?: number
  errmsg?: string
}

@Injectable()
export class WechatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly auth: AuthService
  ) {}

  async createWebLoginSession() {
    const sessionId = randomToken(18)
    const scene = `login_${randomToken(12)}`
    const expiresAt = nowPlusSeconds(300)
    await this.prisma.wechatQrSession.create({ data: { sessionId, scene, expiresAt, mode: 'login' } })
    return {
      sessionId,
      scene,
      qrImageUrl: `/api/auth/wechat-miniapp/sessions/${sessionId}/qrcode`,
      expiresAt
    }
  }

  async getWebLoginSession(sessionId: string) {
    const session = await this.prisma.wechatQrSession.findUnique({ where: { sessionId } })
    if (!session) throw new BadRequestException('qr_session_not_found')
    if (session.status === 'pending' && session.expiresAt <= new Date()) {
      await this.prisma.wechatQrSession.update({ where: { sessionId }, data: { status: 'expired' } })
      return { status: 'expired', message: '二维码已过期' }
    }
    return { status: session.status, message: session.status }
  }

  async miniappLogin(code: string) {
    const wx = await this.code2Session(code)
    const openid = String(wx.openid || '').trim()
    if (!openid) throw new UnauthorizedException('wechat_code_invalid')
    const appid = this.requireAppId()
    const account = await this.prisma.oauthAccount.findUnique({
      where: { provider_appid_openid: { provider: 'wechat_miniapp', appid, openid } },
      include: { user: true }
    })
    const token = randomToken()
    const expiresAt = nowPlusSeconds(24 * 60 * 60)
    await this.prisma.wechatMiniappSession.create({
      data: {
        sessionTokenHash: sha256(token),
        openid,
        unionid: wx.unionid || null,
        userId: account?.userId || null,
        expiresAt
      }
    })
    return {
      miniappSessionToken: token,
      user: account?.user
        ? { id: account.user.id, displayName: account.user.displayName, bound: true }
        : { bound: false },
      expiresAt
    }
  }

  async miniappMe(sessionToken: string) {
    const session = await this.verifyMiniappSession(sessionToken)
    const balance = session.userId ? await this.userBalance(session.userId) : BigInt(0)
    return {
      openid: session.openid.slice(0, 6) + '***',
      bound: Boolean(session.userId),
      userId: session.userId,
      tokenBalance: balance.toString()
    }
  }

  async scan(scene: string, sessionToken: string) {
    const mini = await this.verifyMiniappSession(sessionToken)
    const qr = await this.prisma.wechatQrSession.findUnique({ where: { scene } })
    if (!qr) throw new BadRequestException('qr_session_not_found')
    if (qr.expiresAt <= new Date()) throw new BadRequestException('qr_session_expired')
    const updated = await this.prisma.wechatQrSession.update({
      where: { scene },
      data: { status: 'scanned', scannedAt: new Date(), openid: mini.openid, unionid: mini.unionid }
    })
    return { status: updated.status }
  }

  async confirm(scene: string, sessionToken: string, res?: Response, meta?: { ip: string; userAgent: string }) {
    const mini = await this.verifyMiniappSession(sessionToken)
    const qr = await this.prisma.wechatQrSession.findUnique({ where: { scene } })
    if (!qr) throw new BadRequestException('qr_session_not_found')
    if (qr.expiresAt <= new Date()) throw new BadRequestException('qr_session_expired')

    const appid = this.requireAppId()
    const user = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.oauthAccount.findUnique({
        where: { provider_appid_openid: { provider: 'wechat_miniapp', appid, openid: mini.openid } },
        include: { user: true }
      })
      if (existing?.user) return existing.user
      const created = await tx.user.create({ data: { displayName: '微信用户' } })
      await tx.oauthAccount.create({
        data: {
          provider: 'wechat_miniapp',
          appid,
          openid: mini.openid,
          unionid: mini.unionid,
          userId: created.id
        }
      })
      await tx.wechatMiniappSession.update({
        where: { id: mini.id },
        data: { userId: created.id }
      })
      return created
    })

    await this.prisma.wechatQrSession.update({
      where: { scene },
      data: { status: 'confirmed', confirmedAt: new Date(), userId: user.id, openid: mini.openid, unionid: mini.unionid }
    })

    if (res && meta) {
      await this.auth.createUserSession(user.id, res, meta)
    }
    return { status: 'confirmed', userId: user.id }
  }

  async verifyMiniappSession(sessionToken: string) {
    if (!sessionToken) throw new UnauthorizedException('unauthorized')
    const session = await this.prisma.wechatMiniappSession.findFirst({
      where: { sessionTokenHash: sha256(sessionToken), revokedAt: null, expiresAt: { gt: new Date() } }
    })
    if (!session) throw new UnauthorizedException('unauthorized')
    return session
  }

  private async code2Session(code: string): Promise<Code2SessionResponse> {
    const appid = this.requireAppId()
    const secret = this.config.get<string>('WECHAT_MINIAPP_APP_SECRET')
    if (!secret) throw new BadRequestException('wechat_config_incomplete')
    const url = new URL('https://api.weixin.qq.com/sns/jscode2session')
    url.searchParams.set('appid', appid)
    url.searchParams.set('secret', secret)
    url.searchParams.set('js_code', code)
    url.searchParams.set('grant_type', 'authorization_code')
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
    const data = (await res.json()) as Code2SessionResponse
    if (!res.ok || data.errcode) throw new UnauthorizedException('wechat_code_invalid')
    return data
  }

  private requireAppId() {
    const appid = this.config.get<string>('WECHAT_MINIAPP_APP_ID')
    if (!appid) throw new BadRequestException('wechat_config_incomplete')
    return appid
  }

  private async userBalance(userId: string) {
    const grants = await this.prisma.tokenGrant.findMany({
      where: { userId, status: 'active', expiresAt: { gt: new Date() } },
      select: { remainingTokens: true }
    })
    return grants.reduce((sum, grant) => sum + grant.remainingTokens, BigInt(0))
  }
}
