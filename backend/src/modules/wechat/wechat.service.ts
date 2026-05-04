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

type WechatAccessTokenResponse = {
  access_token?: string
  expires_in?: number
  errcode?: number
  errmsg?: string
}

@Injectable()
export class WechatService {
  private accessTokenCache: { token: string; expiresAt: number } | null = null

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

  async getWebLoginSession(sessionId: string, res?: Response, meta?: { ip: string; userAgent: string }) {
    const session = await this.prisma.wechatQrSession.findUnique({ where: { sessionId } })
    if (!session) throw new BadRequestException('qr_session_not_found')
    if (session.status === 'pending' && session.expiresAt <= new Date()) {
      await this.prisma.wechatQrSession.update({ where: { sessionId }, data: { status: 'expired' } })
      return { status: 'expired', message: '二维码已过期' }
    }
    if (session.status === 'confirmed' && session.userId && res && meta) {
      await this.auth.createUserSession(session.userId, res, meta)
      return { status: 'confirmed', message: '登录成功' }
    }
    return { status: session.status, message: session.status }
  }

  async getWebLoginQrCode(sessionId: string) {
    const session = await this.prisma.wechatQrSession.findUnique({ where: { sessionId } })
    if (!session) throw new BadRequestException('qr_session_not_found')
    if (session.expiresAt <= new Date()) {
      await this.prisma.wechatQrSession.update({ where: { sessionId }, data: { status: 'expired' } })
      throw new BadRequestException('qr_session_expired')
    }
    const accessToken = await this.getAccessToken()
    const page = this.config.get<string>('WECHAT_MINIAPP_PAGE_PATH') || 'pages/index/index'
    const envVersion = this.config.get<string>('WECHAT_MINIAPP_ENV_VERSION') || 'release'
    const res = await fetch(`https://api.weixin.qq.com/wxa/getwxacodeunlimit?access_token=${encodeURIComponent(accessToken)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scene: session.scene,
        page,
        check_path: false,
        env_version: envVersion
      }),
      signal: AbortSignal.timeout(10000)
    })
    const contentType = res.headers.get('content-type') || ''
    const bytes = Buffer.from(await res.arrayBuffer())
    if (!res.ok || contentType.includes('application/json')) {
      const data = this.parseJsonBuffer(bytes)
      throw new BadRequestException(data?.errmsg || data?.errcode || 'wechat_qrcode_failed')
    }
    return { bytes, contentType: contentType || 'image/png' }
  }

  async miniappLogin(code: string) {
    const wx = await this.code2Session(code)
    const openid = String(wx.openid || '').trim()
    if (!openid) throw new UnauthorizedException('wechat_code_invalid')
    const appid = this.requireAppId()
    const user = await this.resolveMiniappUser(appid, openid, wx.unionid || null)
    const token = randomToken()
    const expiresAt = nowPlusSeconds(24 * 60 * 60)
    await this.prisma.wechatMiniappSession.create({
      data: {
        sessionTokenHash: sha256(token),
        openid,
        unionid: wx.unionid || null,
        userId: user.id,
        expiresAt
      }
    })
    return {
      miniappSessionToken: token,
      user: { id: user.id, displayName: user.displayName, avatarUrl: user.avatarUrl, bound: true },
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

  async confirm(scene: string, sessionToken: string) {
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
    if (!res.ok || data.errcode) {
      if (this.config.get<string>('NODE_ENV') !== 'production') {
        throw new UnauthorizedException({
          code: 'wechat_code_invalid',
          errcode: data.errcode,
          errmsg: data.errmsg
        })
      }
      throw new UnauthorizedException('wechat_code_invalid')
    }
    return data
  }

  private async getAccessToken() {
    if (this.accessTokenCache && this.accessTokenCache.expiresAt > Date.now() + 60_000) {
      return this.accessTokenCache.token
    }
    const appid = this.requireAppId()
    const secret = this.config.get<string>('WECHAT_MINIAPP_APP_SECRET')
    if (!secret) throw new BadRequestException('wechat_config_incomplete')
    const url = new URL('https://api.weixin.qq.com/cgi-bin/token')
    url.searchParams.set('grant_type', 'client_credential')
    url.searchParams.set('appid', appid)
    url.searchParams.set('secret', secret)
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
    const data = (await res.json()) as WechatAccessTokenResponse
    if (!res.ok || data.errcode || !data.access_token) throw new BadRequestException('wechat_access_token_failed')
    this.accessTokenCache = {
      token: data.access_token,
      expiresAt: Date.now() + Math.max(300, Number(data.expires_in || 7200) - 300) * 1000
    }
    return data.access_token
  }

  private parseJsonBuffer(bytes: Buffer) {
    try {
      return JSON.parse(bytes.toString('utf8')) as { errcode?: number; errmsg?: string }
    } catch {
      return null
    }
  }

  private requireAppId() {
    const appid = this.config.get<string>('WECHAT_MINIAPP_APP_ID')
    if (!appid) throw new BadRequestException('wechat_config_incomplete')
    return appid
  }

  private async resolveMiniappUser(appid: string, openid: string, unionid: string | null) {
    return this.prisma.$transaction(async (tx) => {
      const miniappAccount = await tx.oauthAccount.findUnique({
        where: { provider_appid_openid: { provider: 'wechat_miniapp', appid, openid } },
        include: { user: true }
      })
      if (miniappAccount) {
        if (unionid && miniappAccount.unionid !== unionid) {
          await tx.oauthAccount.update({ where: { id: miniappAccount.id }, data: { unionid, lastLoginAt: new Date() } })
        } else {
          await tx.oauthAccount.update({ where: { id: miniappAccount.id }, data: { lastLoginAt: new Date() } })
        }
        return miniappAccount.user
      }

      const unionAccount = unionid
        ? await tx.oauthAccount.findFirst({
            where: { unionid },
            include: { user: true },
            orderBy: { boundAt: 'asc' }
          })
        : null

      const user = unionAccount?.user || await tx.user.create({ data: { displayName: '微信用户' } })
      await tx.oauthAccount.create({
        data: {
          provider: 'wechat_miniapp',
          appid,
          openid,
          unionid,
          userId: user.id,
          lastLoginAt: new Date()
        }
      })
      return user
    })
  }

  private async userBalance(userId: string) {
    const grants = await this.prisma.tokenGrant.findMany({
      where: { userId, status: 'active', expiresAt: { gt: new Date() } },
      select: { remainingTokens: true }
    })
    return grants.reduce((sum, grant) => sum + grant.remainingTokens, BigInt(0))
  }
}
