import { Body, Controller, Get, Param, Post, Req, Res } from '@nestjs/common'
import { Request, Response } from 'express'
import { getClientIp, getUserAgent } from '../../common/http'
import { WechatService } from './wechat.service'

@Controller()
export class WechatController {
  constructor(private readonly wechat: WechatService) {}

  @Post('auth/wechat-miniapp/sessions')
  createWebLoginSession() {
    return this.wechat.createWebLoginSession()
  }

  @Get('auth/wechat-miniapp/sessions/:sessionId')
  getWebLoginSession(@Param('sessionId') sessionId: string, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.wechat.getWebLoginSession(sessionId, res, {
      ip: getClientIp(req),
      userAgent: getUserAgent(req)
    })
  }

  @Get('auth/wechat-miniapp/sessions/:sessionId/qrcode')
  async getWebLoginQrCode(@Param('sessionId') sessionId: string, @Res() res: Response) {
    const qrcode = await this.wechat.getWebLoginQrCode(sessionId)
    res.setHeader('Content-Type', qrcode.contentType)
    res.setHeader('Cache-Control', 'no-store')
    res.send(qrcode.bytes)
  }

  @Post('wechat/miniapp/auth/login')
  miniappLogin(@Body() body: { code?: string }) {
    return this.wechat.miniappLogin(String(body.code || ''))
  }

  @Get('wechat/miniapp/me')
  miniappMe(@Req() req: Request) {
    return this.wechat.miniappMe(String(req.headers.authorization || '').replace(/^Bearer\s+/i, ''))
  }

  @Post('wechat/miniapp/sessions/scan')
  scan(@Body() body: { scene?: string; miniappSessionToken?: string }) {
    return this.wechat.scan(String(body.scene || ''), String(body.miniappSessionToken || ''))
  }

  @Post('wechat/miniapp/sessions/confirm')
  confirm(@Body() body: { scene?: string; miniappSessionToken?: string }) {
    return this.wechat.confirm(String(body.scene || ''), String(body.miniappSessionToken || ''))
  }

  @Post('wechat/miniapp/auth/link-email')
  linkEmail(
    @Body()
    body: {
      miniappSessionToken?: string
      email?: string
      password?: string
      code?: string
    }
  ) {
    return this.wechat.linkEmail(
      String(body.miniappSessionToken || ''),
      String(body.email || ''),
      String(body.password || ''),
      String(body.code || '')
    )
  }

  @Post('wechat/miniapp/auth/unlink-email')
  unlinkEmail(@Body() body: { miniappSessionToken?: string }) {
    return this.wechat.unlinkEmail(String(body.miniappSessionToken || ''))
  }
}
