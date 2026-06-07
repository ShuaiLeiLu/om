import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Response } from 'express'
import * as argon2 from 'argon2'
import { AuthService } from '../auth/auth.service'
import { EmailVerificationService } from '../auth/email-verification.service'
import { PrismaService } from '../prisma/prisma.service'
import { nowPlusSeconds, randomToken, sha256 } from '../../common/http'

type SseClient = { sessionId: string; res: Response; timer: ReturnType<typeof setTimeout> }

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
  private sseClients: Map<string, SseClient[]> = new Map()

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly auth: AuthService,
    private readonly verification: EmailVerificationService
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
    const envVersion = this.getMiniappEnvVersion()
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
    const user = session.userId
      ? await this.prisma.user.findUnique({
          where: { id: session.userId },
          select: {
            id: true,
            displayName: true,
            avatarUrl: true,
            email: true,
            emailVerifiedAt: true
          }
        })
      : null
    const balance = session.userId ? await this.userBalance(session.userId) : BigInt(0)
    return {
      openid: session.openid.slice(0, 6) + '***',
      bound: Boolean(session.userId),
      userId: session.userId,
      pointsBalance: balance.toString(),
      displayName: user?.displayName || '',
      avatarUrl: user?.avatarUrl || '',
      email: user?.email || null,
      emailVerified: !!user?.emailVerifiedAt
    }
  }

  /**
   * 把当前小程序登录的微信账号与一个邮箱+密码账号绑定。
   *
   * 情况 1：邮箱在系统里不存在 → 直接给当前 User 设 email + passwordHash
   * 情况 2：邮箱已经被其他 User 占用 → 如果该邮箱账号没绑定过微信，
   * 校验该邮箱账号密码后，把当前微信账号数据合并过去。
   */
  async linkEmail(sessionToken: string, email: string, password: string, code: string) {
    const session = await this.verifyMiniappSession(sessionToken)
    if (!session.userId) throw new UnauthorizedException('wechat_not_bound')

    const normalizedEmail = String(email || '').trim().toLowerCase()
    if (!normalizedEmail || !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(normalizedEmail)) {
      throw new BadRequestException('invalid_email')
    }
    if (!password || password.length < 8 || password.length > 128) {
      throw new BadRequestException('password_too_short')
    }
    if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      throw new BadRequestException('password_too_weak')
    }

    const user = await this.prisma.user.findUnique({ where: { id: session.userId } })
    if (!user) throw new UnauthorizedException('unauthorized')

    if (user.email && user.email !== normalizedEmail) {
      throw new BadRequestException('email_already_set')
    }

    const taken = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: {
        oauthAccounts: {
          where: { provider: 'wechat_miniapp' },
          select: { id: true }
        }
      }
    })
    if (taken && taken.id !== user.id) {
      if (taken.oauthAccounts.length > 0) throw new BadRequestException('email_already_bound_to_other')
      if (!taken.passwordHash) throw new BadRequestException('email_already_bound_to_other')
      const passwordOk = await argon2.verify(taken.passwordHash, password)
      if (!passwordOk) throw new UnauthorizedException('invalid_credentials')

      await this.verification.verifyCode({
        email: normalizedEmail,
        purpose: 'bind_email',
        code
      })

      await this.mergeUserIntoExistingEmailUser(user.id, taken.id)

      return {
        ok: true as const,
        email: taken.email,
        emailVerified: !!taken.emailVerifiedAt
      }
    }

    // 校验邮箱验证码（防止有人乱填别人邮箱来占用）
    await this.verification.verifyCode({
      email: normalizedEmail,
      purpose: 'bind_email',
      code
    })

    const passwordHash = await argon2.hash(password, { type: argon2.argon2id })
    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        email: normalizedEmail,
        passwordHash,
        emailVerifiedAt: user.emailVerifiedAt || new Date()
      }
    })

    return {
      ok: true as const,
      email: updated.email,
      emailVerified: !!updated.emailVerifiedAt
    }
  }

  /** 解绑邮箱（清空 email + passwordHash）。保留微信 oauth 不动。 */
  async unlinkEmail(sessionToken: string) {
    const session = await this.verifyMiniappSession(sessionToken)
    if (!session.userId) throw new UnauthorizedException('wechat_not_bound')

    const user = await this.prisma.user.findUnique({ where: { id: session.userId } })
    if (!user) throw new UnauthorizedException('unauthorized')
    if (!user.email) return { ok: true as const }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { email: null, passwordHash: null, emailVerifiedAt: null }
    })
    return { ok: true as const }
  }

  // ── SSE 实时推送 ──────────────────────────────────────────────

  subscribeSessionSse(sessionId: string, res: Response) {
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no')
    res.flushHeaders()

    // 立即发送当前状态
    this.prisma.wechatQrSession.findUnique({ where: { sessionId } }).then((session) => {
      if (!session) {
        res.write(`data: ${JSON.stringify({ status: 'failed', message: '会话不存在' })}\n\n`)
        res.end()
        return
      }
      const status = session.expiresAt <= new Date() ? 'expired' : session.status
      res.write(`data: ${JSON.stringify({ status })}\n\n`)
    })

    const timer = setTimeout(() => {
      res.write(`data: ${JSON.stringify({ status: 'expired', message: '连接超时' })}\n\n`)
      res.end()
      this.removeSseClient(sessionId, client)
    }, 5 * 60 * 1000)

    const client: SseClient = { sessionId, res, timer }
    const list = this.sseClients.get(sessionId) || []
    list.push(client)
    this.sseClients.set(sessionId, list)

    res.on('close', () => this.removeSseClient(sessionId, client))
  }

  private notifySseClients(sessionId: string, data: { status: string; message?: string }) {
    const list = this.sseClients.get(sessionId)
    if (!list?.length) return
    const payload = `data: ${JSON.stringify(data)}\n\n`
    for (const client of list) {
      try { client.res.write(payload) } catch {}
    }
    if (data.status === 'confirmed' || data.status === 'expired' || data.status === 'failed') {
      for (const client of list) {
        clearTimeout(client.timer)
        try { client.res.end() } catch {}
      }
      this.sseClients.delete(sessionId)
    }
  }

  private removeSseClient(sessionId: string, client: SseClient) {
    clearTimeout(client.timer)
    const list = this.sseClients.get(sessionId)
    if (!list) return
    const idx = list.indexOf(client)
    if (idx >= 0) list.splice(idx, 1)
    if (list.length === 0) this.sseClients.delete(sessionId)
  }

  // ── 登录码 ──────────────────────────────────────────────────

  async createLoginCode(sessionToken: string) {
    const mini = await this.verifyMiniappSession(sessionToken)
    if (!mini.userId) throw new UnauthorizedException('wechat_not_bound')

    // 清理该用户之前的未使用登录码
    await this.prisma.wechatQrSession.updateMany({
      where: { userId: mini.userId, mode: 'login_code', status: 'pending' },
      data: { status: 'expired' }
    })

    const code = String(Math.floor(100000 + Math.random() * 900000)) // 6 位数字
    const expiresAt = nowPlusSeconds(120) // 2 分钟
    await this.prisma.wechatQrSession.create({
      data: {
        sessionId: randomToken(18),
        scene: `code_${code}_${randomToken(6)}`,
        mode: 'login_code',
        status: 'pending',
        userId: mini.userId,
        openid: mini.openid,
        unionid: mini.unionid,
        loginCode: code,
        expiresAt
      }
    })
    return { code, expiresAt }
  }

  async verifyLoginCode(code: string, res: Response, meta: { ip: string; userAgent: string }) {
    const trimmed = String(code || '').trim()
    if (!/^\d{6}$/.test(trimmed)) throw new BadRequestException('invalid_login_code')

    const record = await this.prisma.wechatQrSession.findFirst({
      where: { loginCode: trimmed, mode: 'login_code', status: 'pending', expiresAt: { gt: new Date() } }
    })
    if (!record) throw new BadRequestException('login_code_invalid_or_expired')
    if (!record.userId) throw new BadRequestException('login_code_no_user')

    await this.prisma.wechatQrSession.update({
      where: { id: record.id },
      data: { status: 'confirmed', confirmedAt: new Date() }
    })

    await this.auth.createUserSession(record.userId, res, meta)
    return { status: 'confirmed', message: '登录成功' }
  }

  // ── 扫码登录（合并 scan + confirm 为一步） ──────────────────

  async scanAndConfirm(scene: string, sessionToken: string) {
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
      data: {
        status: 'confirmed',
        scannedAt: new Date(),
        confirmedAt: new Date(),
        userId: user.id,
        openid: mini.openid,
        unionid: mini.unionid
      }
    })

    // 通知 SSE 客户端
    this.notifySseClients(qr.sessionId, { status: 'confirmed', message: '登录成功' })

    return { status: 'confirmed', userId: user.id }
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
    this.notifySseClients(qr.sessionId, { status: 'scanned' })
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

    this.notifySseClients(qr.sessionId, { status: 'confirmed', message: '登录成功' })

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

  private getMiniappEnvVersion() {
    const envVersion = String(this.config.get<string>('WECHAT_MINIAPP_ENV_VERSION') || 'release').trim()
    if (['release', 'trial', 'develop'].includes(envVersion)) return envVersion
    throw new BadRequestException('wechat_env_version_invalid')
  }

  private async mergeUserIntoExistingEmailUser(sourceUserId: string, targetUserId: string) {
    if (sourceUserId === targetUserId) return

    await this.prisma.$transaction(async (tx) => {
      const sourceStorage = await tx.storageUsage.findUnique({ where: { userId: sourceUserId } })
      if (sourceStorage) {
        await tx.storageUsage.upsert({
          where: { userId: targetUserId },
          create: {
            userId: targetUserId,
            bytesTotal: sourceStorage.bytesTotal,
            imagesCount: sourceStorage.imagesCount
          },
          update: {
            bytesTotal: { increment: sourceStorage.bytesTotal },
            imagesCount: { increment: sourceStorage.imagesCount }
          }
        })
        await tx.storageUsage.delete({ where: { userId: sourceUserId } })
      }

      const sourceImageRefs = await tx.userImageRef.findMany({ where: { userId: sourceUserId } })
      for (const ref of sourceImageRefs) {
        await tx.userImageRef.upsert({
          where: { userId_imageId: { userId: targetUserId, imageId: ref.imageId } },
          create: {
            userId: targetUserId,
            imageId: ref.imageId,
            count: ref.count,
            bytes: ref.bytes
          },
          update: {
            count: { increment: ref.count },
            bytes: { increment: ref.bytes }
          }
        })
      }
      await tx.userImageRef.deleteMany({ where: { userId: sourceUserId } })

      await tx.oauthAccount.updateMany({ where: { userId: sourceUserId }, data: { userId: targetUserId } })
      await tx.userSession.updateMany({ where: { userId: sourceUserId }, data: { userId: targetUserId } })
      await tx.wechatQrSession.updateMany({ where: { userId: sourceUserId }, data: { userId: targetUserId } })
      await tx.wechatMiniappSession.updateMany({ where: { userId: sourceUserId }, data: { userId: targetUserId } })
      const sourcePoints = await tx.pointAccount.findUnique({ where: { userId: sourceUserId } })
      if (sourcePoints) {
        const targetPoints = await tx.pointAccount.upsert({
          where: { userId: targetUserId },
          create: { userId: targetUserId, balance: BigInt(0) },
          update: {}
        })
        await tx.pointAccount.update({
          where: { userId: targetUserId },
          data: { balance: targetPoints.balance + sourcePoints.balance }
        })
        await tx.pointAccount.delete({ where: { userId: sourceUserId } })
      }
      await tx.pointLedger.updateMany({ where: { userId: sourceUserId }, data: { userId: targetUserId } })
      await tx.conversation.updateMany({ where: { userId: sourceUserId }, data: { userId: targetUserId } })
      await tx.message.updateMany({ where: { userId: sourceUserId }, data: { userId: targetUserId } })
      await tx.llmRequest.updateMany({ where: { userId: sourceUserId }, data: { userId: targetUserId } })
      await tx.usageEvent.updateMany({ where: { userId: sourceUserId }, data: { userId: targetUserId } })
      await tx.adRewardSession.updateMany({ where: { userId: sourceUserId }, data: { userId: targetUserId } })
      await tx.adRewardEvent.updateMany({ where: { userId: sourceUserId }, data: { userId: targetUserId } })
      await tx.image.updateMany({ where: { ownerUserId: sourceUserId }, data: { ownerUserId: targetUserId } })
      await tx.imageTask.updateMany({ where: { userId: sourceUserId }, data: { userId: targetUserId } })
      await tx.user.delete({ where: { id: sourceUserId } })
    })
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
    const account = await this.prisma.pointAccount.findUnique({
      where: { userId },
      select: { balance: true }
    })
    return account?.balance || BigInt(0)
  }
}
