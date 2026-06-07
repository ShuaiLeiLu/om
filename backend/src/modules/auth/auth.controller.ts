import {
  BadRequestException,
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
import { CasdoorOauthService } from './casdoor-oauth.service'

@Controller()
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly casdoor: CasdoorOauthService
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
    const casdoorRequired = this.casdoor.isRequired()
    return {
      qrcode: false,
      loginCode: false,
      local: false,
      casdoor: this.casdoor.isEnabled(),
      casdoorRequired,
      wechatOauthWeb: false,
      wechatOauthH5: false
    }
  }

  // ---------- Casdoor 统一登录 ----------

  @Get('auth/casdoor/start')
  startCasdoorOauth(
    @Query('next') next: string | undefined,
    @Query('popup') popup: string | undefined,
    @Query('format') format: string | undefined,
    @Res({ passthrough: true }) res: Response
  ) {
    const built = this.casdoor.buildAuthorizeUrl({
      next,
      popup: popup === '1' || popup === 'true'
    })
    if (format === 'json') return { url: built.url, expiresIn: built.expiresIn }
    res.redirect(302, built.url)
    return
  }

  @Get('auth/casdoor/callback')
  async callbackCasdoorOauth(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Req() req: Request,
    @Res() res: Response
  ) {
    if (!code || !state) {
      res.status(400).type('html').send(this.casdoor.buildPopupCallbackHtml(false, '缺少 code 或 state'))
      return
    }
    try {
      const result = await this.casdoor.handleCallback({ code, state, req, res })
      if (result.popup) {
        res.type('html').send(this.casdoor.buildPopupCallbackHtml(true))
      } else {
        res.redirect(302, result.next || (result.type === 'admin' ? '/admin' : '/'))
      }
    } catch (err) {
      const message = err instanceof BadRequestException ? err.message : (err as Error).message
      res.status(401).type('html').send(this.casdoor.buildPopupCallbackHtml(false, message || '登录失败'))
    }
  }
}
