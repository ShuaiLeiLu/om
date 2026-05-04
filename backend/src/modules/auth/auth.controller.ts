import { Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common'
import { Request, Response } from 'express'
import { CurrentUser } from '../../common/current-user'
import { getClientIp, getUserAgent } from '../../common/http'
import { UserSessionGuard } from '../../common/session.guard'
import { AuthService } from './auth.service'

@Controller()
export class AuthController {
  constructor(private readonly auth: AuthService) {}

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
  async refresh(@CurrentUser() user: { id: string }, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(req.cookies?.chatty_session, res)
    return this.auth.createUserSession(user.id, res, { ip: getClientIp(req), userAgent: getUserAgent(req) })
  }
}
