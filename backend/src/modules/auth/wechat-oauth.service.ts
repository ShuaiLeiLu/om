import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { createHmac } from 'crypto'
import { Request, Response } from 'express'
import { PrismaService } from '../prisma/prisma.service'
import { getClientIp, getUserAgent, randomToken } from '../../common/http'
import { AuthService } from './auth.service'

/**
 * 微信开放平台 OAuth 一键登录服务。
 *
 * 支持两种模式：
 *  - `web`：开放平台「微信登录」（scope=snsapi_login），桌面浏览器弹出二维码 +
 *    用户在微信 App 内确认；
 *  - `h5`：公众号网页授权（scope=snsapi_userinfo），仅在微信内置浏览器中可用。
 *
 * 两种模式共用同一套 callback 处理逻辑：
 *  1. 校验 state 签名（stateless HMAC，TTL 10 min）；
 *  2. 用 code 换 access_token + openid（+ unionid）；
 *  3. 拉 userinfo 拿昵称/头像；
 *  4. upsert OauthAccount + User，写 cookie session；
 *  5. 弹窗模式回一段 HTML，调用 `window.opener.postMessage` 并关闭；
 *     普通模式 302 到 `next`。
 *
 * 必需环境变量（任一模式都需要）：
 *  - WECHAT_OPEN_APP_ID
 *  - WECHAT_OPEN_APP_SECRET
 *  - WECHAT_OPEN_REDIRECT_URI（完整 URL，必须与开放平台后台配置完全一致）
 *
 * 可选：
 *  - WECHAT_OFFIACCOUNT_APP_ID  / WECHAT_OFFIACCOUNT_APP_SECRET（h5 模式独立 appid）
 *  - WECHAT_OAUTH_STATE_TTL_SECONDS（默认 600）
 */

type StatePayload = {
  mode: 'web' | 'h5'
  next: string
  popup: boolean
  nonce: string
  exp: number
}

type AccessTokenResponse = {
  access_token?: string
  expires_in?: number
  refresh_token?: string
  openid?: string
  scope?: string
  unionid?: string
  errcode?: number
  errmsg?: string
}

type UserInfoResponse = {
  openid?: string
  nickname?: string
  sex?: number
  province?: string
  city?: string
  country?: string
  headimgurl?: string
  unionid?: string
  errcode?: number
  errmsg?: string
}

const PROVIDER = {
  web: 'wechat_open',
  h5: 'wechat_offiaccount'
} as const

const STATE_VERSION = 1

@Injectable()
export class WechatOauthService {
  private readonly logger = new Logger(WechatOauthService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly auth: AuthService
  ) {}

  /** 是否启用 web（开放平台）一键登录 */
  isWebEnabled() {
    return !!(this.getOpenAppId() && this.getOpenAppSecret() && this.getRedirectUri())
  }

  /** 是否启用 h5（公众号网页授权）一键登录 */
  isH5Enabled() {
    return !!(this.getH5AppId() && this.getH5AppSecret() && this.getRedirectUri())
  }

  /**
   * 生成授权 URL。前端拿到后整页跳转或 popup 打开。
   */
  buildAuthorizeUrl(opts: { mode: 'web' | 'h5'; next?: string; popup?: boolean }) {
    const mode = opts.mode
    if (mode === 'web' && !this.isWebEnabled()) {
      throw new BadRequestException('wechat_oauth_web_not_configured')
    }
    if (mode === 'h5' && !this.isH5Enabled()) {
      throw new BadRequestException('wechat_oauth_h5_not_configured')
    }

    const ttl = Number(this.config.get<string>('WECHAT_OAUTH_STATE_TTL_SECONDS') || 600)
    const payload: StatePayload = {
      mode,
      next: this.normalizeNext(opts.next),
      popup: !!opts.popup,
      nonce: randomToken(12),
      exp: Math.floor(Date.now() / 1000) + ttl
    }
    const state = this.signState(payload)

    const appid = mode === 'web' ? this.getOpenAppId()! : this.getH5AppId()!
    const redirectUri = this.getRedirectUri()!
    const scope = mode === 'web' ? 'snsapi_login' : 'snsapi_userinfo'
    const base =
      mode === 'web'
        ? 'https://open.weixin.qq.com/connect/qrconnect'
        : 'https://open.weixin.qq.com/connect/oauth2/authorize'

    const params = new URLSearchParams({
      appid,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope,
      state
    })

    return {
      url: `${base}?${params.toString()}#wechat_redirect`,
      state,
      expiresIn: ttl
    }
  }

  /** 处理 OAuth 回调。 */
  async handleCallback(args: {
    code: string
    state: string
    req: Request
    res: Response
  }) {
    const { code, state, req, res } = args
    if (!code || !state) throw new BadRequestException('missing_code_or_state')

    const parsed = this.verifyState(state)
    if (!parsed) throw new UnauthorizedException('invalid_or_expired_state')

    const tokenInfo = await this.exchangeCodeForToken(parsed.mode, code)
    const openid = (tokenInfo.openid || '').trim()
    if (!openid) throw new UnauthorizedException('wechat_openid_missing')

    let userInfo: UserInfoResponse = {}
    if (tokenInfo.access_token) {
      // h5 with scope=snsapi_userinfo and web with scope=snsapi_login both support userinfo.
      try {
        userInfo = await this.fetchUserInfo(tokenInfo.access_token, openid)
      } catch (err) {
        // Fall back without profile info — login still succeeds with openid.
        this.logger.warn(`fetchUserInfo failed: ${(err as Error).message}`)
      }
    }

    const appid = parsed.mode === 'web' ? this.getOpenAppId()! : this.getH5AppId()!
    const provider = PROVIDER[parsed.mode]
    const user = await this.resolveOrCreateUser({
      provider,
      appid,
      openid,
      unionid: tokenInfo.unionid || userInfo.unionid || null,
      displayName: userInfo.nickname,
      avatarUrl: userInfo.headimgurl
    })

    await this.auth.createUserSession(user.id, res, {
      ip: getClientIp(req),
      userAgent: getUserAgent(req)
    })

    return {
      ok: true as const,
      next: parsed.next,
      popup: parsed.popup,
      user: { id: user.id, displayName: user.displayName, avatarUrl: user.avatarUrl }
    }
  }

  /** Build the small HTML page that closes a popup window after successful auth. */
  buildPopupCallbackHtml(ok: boolean, message?: string) {
    const payload = JSON.stringify({ type: 'chatty:wechat_oauth', ok, message: message || '' })
    return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>登录回调</title>
<style>html,body{margin:0;background:#050614;color:#e2e8f0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;height:100%;display:flex;align-items:center;justify-content:center}.box{padding:24px;text-align:center}</style>
</head><body><div class="box"><h1 style="font-size:18px;margin:0 0 8px">${ok ? '登录成功' : '登录失败'}</h1><p style="font-size:13px;color:#94a3b8;margin:0">${ok ? '正在关闭窗口…' : (message || '请重试')}</p></div>
<script>(function(){try{if(window.opener){window.opener.postMessage(${payload},"*");}}catch(e){}setTimeout(function(){try{window.close()}catch(e){}},800);})();</script>
</body></html>`
  }

  // ---------- internals ----------

  private signState(payload: StatePayload): string {
    const body = Buffer.from(JSON.stringify({ v: STATE_VERSION, ...payload })).toString('base64url')
    const sig = createHmac('sha256', this.stateSecret()).update(body).digest('base64url')
    return `${body}.${sig}`
  }

  private verifyState(state: string): StatePayload | null {
    if (!state || !state.includes('.')) return null
    const [body, sig] = state.split('.', 2)
    if (!body || !sig) return null
    const expected = createHmac('sha256', this.stateSecret()).update(body).digest('base64url')
    if (sig !== expected) return null
    try {
      const data = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
      if (data?.v !== STATE_VERSION) return null
      if (typeof data.exp !== 'number' || data.exp < Math.floor(Date.now() / 1000)) return null
      if (data.mode !== 'web' && data.mode !== 'h5') return null
      return {
        mode: data.mode,
        next: this.normalizeNext(data.next),
        popup: !!data.popup,
        nonce: String(data.nonce || ''),
        exp: data.exp
      }
    } catch {
      return null
    }
  }

  private async exchangeCodeForToken(mode: 'web' | 'h5', code: string): Promise<AccessTokenResponse> {
    const appid = mode === 'web' ? this.getOpenAppId()! : this.getH5AppId()!
    const secret = mode === 'web' ? this.getOpenAppSecret()! : this.getH5AppSecret()!
    const url = new URL('https://api.weixin.qq.com/sns/oauth2/access_token')
    url.searchParams.set('appid', appid)
    url.searchParams.set('secret', secret)
    url.searchParams.set('code', code)
    url.searchParams.set('grant_type', 'authorization_code')
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
    const data = (await res.json()) as AccessTokenResponse
    if (!res.ok || data.errcode || !data.access_token || !data.openid) {
      this.logger.warn(`access_token error: ${data.errcode || ''} ${data.errmsg || ''}`)
      throw new UnauthorizedException('wechat_code_invalid')
    }
    return data
  }

  private async fetchUserInfo(accessToken: string, openid: string): Promise<UserInfoResponse> {
    const url = new URL('https://api.weixin.qq.com/sns/userinfo')
    url.searchParams.set('access_token', accessToken)
    url.searchParams.set('openid', openid)
    url.searchParams.set('lang', 'zh_CN')
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
    const data = (await res.json()) as UserInfoResponse
    if (!res.ok || data.errcode) {
      throw new Error(`userinfo_failed: ${data.errcode} ${data.errmsg}`)
    }
    return data
  }

  private async resolveOrCreateUser(args: {
    provider: string
    appid: string
    openid: string
    unionid: string | null
    displayName?: string
    avatarUrl?: string
  }) {
    const { provider, appid, openid, unionid, displayName, avatarUrl } = args
    return this.prisma.$transaction(async (tx) => {
      // 1) Existing account for this (provider, appid, openid)
      const exact = await tx.oauthAccount.findUnique({
        where: { provider_appid_openid: { provider, appid, openid } },
        include: { user: true }
      })
      if (exact?.user) {
        const updateData: Record<string, unknown> = { lastLoginAt: new Date() }
        if (unionid && exact.unionid !== unionid) updateData.unionid = unionid
        await tx.oauthAccount.update({ where: { id: exact.id }, data: updateData })
        await this.maybeRefreshProfile(tx, exact.user.id, displayName, avatarUrl)
        return exact.user
      }

      // 2) Existing account by unionid (cross-provider linking)
      const unionAccount = unionid
        ? await tx.oauthAccount.findFirst({
            where: { unionid },
            include: { user: true },
            orderBy: { boundAt: 'asc' }
          })
        : null

      const user =
        unionAccount?.user ||
        (await tx.user.create({
          data: {
            displayName: displayName || '微信用户',
            avatarUrl: avatarUrl || ''
          }
        }))

      await tx.oauthAccount.create({
        data: {
          provider,
          appid,
          openid,
          unionid,
          userId: user.id,
          lastLoginAt: new Date()
        }
      })

      // 如果是已存在用户但没头像，补一下
      if (unionAccount?.user) {
        await this.maybeRefreshProfile(tx, user.id, displayName, avatarUrl)
      }
      return user
    })
  }

  private async maybeRefreshProfile(
    tx: Parameters<Parameters<PrismaService['$transaction']>[0]>[0],
    userId: string,
    displayName?: string,
    avatarUrl?: string
  ) {
    const patch: Record<string, unknown> = {}
    const existing = await tx.user.findUnique({ where: { id: userId } })
    if (!existing) return
    if ((!existing.displayName || existing.displayName === '微信用户') && displayName) {
      patch.displayName = displayName
    }
    if (!existing.avatarUrl && avatarUrl) {
      patch.avatarUrl = avatarUrl
    }
    if (Object.keys(patch).length > 0) {
      await tx.user.update({ where: { id: userId }, data: patch })
    }
  }

  private normalizeNext(next: string | undefined | null): string {
    const v = String(next || '/').trim()
    // 只允许同站内部路径，禁止 javascript: / 跨站
    if (!v.startsWith('/') || v.startsWith('//')) return '/'
    return v
  }

  private getOpenAppId() {
    return this.config.get<string>('WECHAT_OPEN_APP_ID') || ''
  }
  private getOpenAppSecret() {
    return this.config.get<string>('WECHAT_OPEN_APP_SECRET') || ''
  }
  private getH5AppId() {
    return (
      this.config.get<string>('WECHAT_OFFIACCOUNT_APP_ID') ||
      this.config.get<string>('WECHAT_OPEN_APP_ID') ||
      ''
    )
  }
  private getH5AppSecret() {
    return (
      this.config.get<string>('WECHAT_OFFIACCOUNT_APP_SECRET') ||
      this.config.get<string>('WECHAT_OPEN_APP_SECRET') ||
      ''
    )
  }
  private getRedirectUri() {
    return this.config.get<string>('WECHAT_OPEN_REDIRECT_URI') || ''
  }
  private stateSecret() {
    return (
      this.config.get<string>('WECHAT_OAUTH_STATE_SECRET') ||
      this.config.get<string>('COOKIE_SECRET') ||
      'chatty-default-state-secret'
    )
  }
}
