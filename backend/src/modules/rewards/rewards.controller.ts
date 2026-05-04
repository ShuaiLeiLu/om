import { Body, Controller, Get, Patch, Post, Req, UseGuards } from '@nestjs/common'
import { Request } from 'express'
import { AdminSessionGuard } from '../../common/session.guard'
import { RewardsService } from './rewards.service'

function bearer(req: Request) {
  return String(req.headers.authorization || '').replace(/^Bearer\s+/i, '')
}

@Controller()
export class RewardsController {
  constructor(private readonly rewards: RewardsService) {}

  @Get('wechat/miniapp/rewards/config')
  config(@Req() req: Request) {
    return this.rewards.config(bearer(req))
  }

  @Post('wechat/miniapp/rewards/sessions')
  createSession(@Req() req: Request) {
    return this.rewards.createSession(bearer(req))
  }

  @Post('wechat/miniapp/rewards/claim')
  claim(@Req() req: Request, @Body() body: { rewardSessionId?: string }) {
    return this.rewards.claim(bearer(req), String(body.rewardSessionId || ''))
  }

  @UseGuards(AdminSessionGuard)
  @Get('admin/wechat/reward-config')
  adminConfig(@Req() req: Request) {
    return this.rewards.config(bearer(req)).catch(() => this.rewards.updateConfig({}))
  }

  @UseGuards(AdminSessionGuard)
  @Patch('admin/wechat/reward-config')
  update(@Body() body: { enabled?: boolean; adUnitId?: string; rewardTokens?: string | number; dailyLimitPerUser?: number; rewardTokenValidDays?: number; minIntervalSeconds?: number; sessionTtlSeconds?: number }) {
    return this.rewards.updateConfig(body)
  }

  @UseGuards(AdminSessionGuard)
  @Get('admin/wechat/reward-events')
  events() {
    return this.rewards.listEvents()
  }
}
