import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  Res,
  UseGuards
} from '@nestjs/common'
import { Request, Response } from 'express'
import { CurrentUser } from '../../common/current-user'
import { getClientIp, getUserAgent } from '../../common/http'
import { UserSessionGuard } from '../../common/session.guard'
import { AuthService } from './auth.service'
import { EmailVerificationService } from './email-verification.service'
import { LocalAuthService } from './local-auth.service'
import { WechatOauthService } from './wechat-oauth.service'

@Controller()
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly local: LocalAuthService,
    private readonly wechatOauth: WechatOauthService,
    private readonly verification: EmailVerificationService
  ) {}

  // ---------- 基础 ----------

  @Post('auth/logout')
  logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.auth.logout(req.cookies?.chatty_session, res)
  }

  @UseGuards(UserSessionGuard)
  @Get('me')
  me(@CurrentUser() user: { id: string }) {
    return this.auth.me(user.id)
  }

  @UseGuards(UserSessionGuard)
  @Post('auth/refresh')
  async refresh(
    @CurrentUser() user: { id: string },
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response
  ) {
    await this.auth.logout(req.cookies?.chatty_session, res)
    return this.auth.createUserSession(user.id, res, {
      ip: getClientIp(req),
      userAgent: getUserAgent(req)
    })
  }

  // ---------- 能力探测 ----------

  /** 前端用来动态显示登录入口（微信一键 / 扫码 / 账号密码）。 */
  @Get('auth/capabilities')
  capabilities() {
    return {
      qrcode: true,
      local: true,
      wechatOauthWeb: this.wechatOauth.isWebEnabled(),
      wechatOauthH5: this.wechatOauth.isH5Enabled()
    }
  }

  // ---------- 邮箱 + 密码 ----------

  /** 发送邮箱验证码。purpose: register | reset_password | bind_email */
  @Post('auth/local/send-code')
  sendCode(
    @Body() body: { email?: string; purpose?: 'register' | 'reset_password' | 'bind_email' },
    @Req() req: Request
  ) {
    const purpose = body.purpose === 'reset_password'
      ? 'reset_password'
      : body.purpose === 'bind_email'
        ? 'bind_email'
        : 'register'
    return this.verification.sendCode({
      email: String(body.email || ''),
      purpose,
      ip: getClientIp(req),
      userAgent: getUserAgent(req)
    })
  }

  @Post('auth/local/register')
  async register(
    @Body()
    body: {
      email?: string
      password?: string
      code?: string
      displayName?: string
    },
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response
  ) {
    const user = await this.local.register({
      email: String(body.email || ''),
      password: String(body.password || ''),
      code: String(body.code || ''),
      displayName: body.displayName ? String(body.displayName) : undefined,
      req,
      res
    })
    return { user }
  }

  @Post('auth/local/reset-password')
  resetPassword(@Body() body: { email?: string; code?: string; newPassword?: string }) {
    return this.local.resetPassword({
      email: String(body.email || ''),
      code: String(body.code || ''),
      newPassword: String(body.newPassword || '')
    })
  }

  @Post('auth/local/login')
  async localLogin(
    @Body() body: { email?: string; password?: string },
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response
  ) {
    const user = await this.local.login({
      email: String(body.email || ''),
      password: String(body.password || ''),
      req,
      res
    })
    return { user }
  }

  @UseGuards(UserSessionGuard)
  @Post('auth/local/change-password')
  async changePassword(
    @CurrentUser() user: { id: string },
    @Body() body: { oldPassword?: string; newPassword?: string }
  ) {
    return this.local.changePassword({
      userId: user.id,
      oldPassword: String(body.oldPassword || ''),
      newPassword: String(body.newPassword || '')
    })
  }

  // ---------- 微信 OAuth 一键登录 ----------

  @Get('auth/wechat/oauth/start')
  startOauth(
    @Query('mode') modeRaw: string | undefined,
    @Query('next') next: string | undefined,
    @Query('popup') popup: string | undefined,
    @Query('format') format: string | undefined,
    @Res({ passthrough: true }) res: Response
  ) {
    const mode = modeRaw === 'h5' ? 'h5' : 'web'
    const isPopup = popup === '1' || popup === 'true'
    const built = this.wechatOauth.buildAuthorizeUrl({ mode, next, popup: isPopup })
    if (format === 'json') {
      return { url: built.url, expiresIn: built.expiresIn }
    }
    res.redirect(302, built.url)
    return
  }

  @Get('auth/wechat/oauth/callback')
  async callbackOauth(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Req() req: Request,
    @Res() res: Response
  ) {
    if (!code || !state) {
      res
        .status(400)
        .type('html')
        .send(this.wechatOauth.buildPopupCallbackHtml(false, '缺少 code 或 state'))
      return
    }
    try {
      const result = await this.wechatOauth.handleCallback({ code, state, req, res })
      if (result.popup) {
        res.type('html').send(this.wechatOauth.buildPopupCallbackHtml(true))
      } else {
        res.redirect(302, result.next || '/')
      }
    } catch (err) {
      const message = err instanceof BadRequestException ? err.message : (err as Error).message
      res
        .status(401)
        .type('html')
        .send(this.wechatOauth.buildPopupCallbackHtml(false, message || '登录失败'))
    }
  }
}
