import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common'
import { CurrentAdmin, CurrentUser } from '../../common/current-user'
import { AdminSessionGuard, UserSessionGuard } from '../../common/session.guard'
import { RewardsService } from './rewards.service'

@Controller()
export class RewardsController {
  constructor(private readonly rewards: RewardsService) {}

  @UseGuards(UserSessionGuard)
  @Get('rewards/config')
  webConfig(@CurrentUser() user: { id: string }) {
    return this.rewards.webConfig(user.id)
  }

  @UseGuards(UserSessionGuard)
  @Post('rewards/sessions')
  webCreateSession(@CurrentUser() user: { id: string }) {
    return this.rewards.webCreateSession(user.id)
  }

  @UseGuards(UserSessionGuard)
  @Post('rewards/claim')
  webClaim(@CurrentUser() user: { id: string }, @Body() body: { rewardSessionId?: string }) {
    return this.rewards.webClaim(user.id, String(body.rewardSessionId || ''))
  }

  @UseGuards(UserSessionGuard)
  @Get('rewards/checkin/status')
  webCheckinStatus(@CurrentUser() user: { id: string }) {
    return this.rewards.getCheckinStatus(user.id)
  }

  @UseGuards(UserSessionGuard)
  @Post('rewards/checkin')
  webCheckin(@CurrentUser() user: { id: string }) {
    return this.rewards.performCheckin(user.id)
  }

  @UseGuards(UserSessionGuard)
  @Get('rewards/tasks/status')
  webDailyTasksStatus(@CurrentUser() user: { id: string }) {
    return this.rewards.getDailyTasksStatus(user.id)
  }

  @UseGuards(UserSessionGuard)
  @Post('rewards/tasks/claim')
  webClaimTaskReward(@CurrentUser() user: { id: string }, @Body() body: { taskType: string }) {
    return this.rewards.claimTaskReward(user.id, body.taskType)
  }

  // Admin endpoints
  @UseGuards(AdminSessionGuard)
  @Get('admin/wechat/reward-config')
  adminConfig() {
    return this.rewards.adminConfig()
  }

  @UseGuards(AdminSessionGuard)
  @Patch('admin/wechat/reward-config')
  update(@CurrentAdmin() admin: { id: string }, @Body() body: { enabled?: boolean; adUnitId?: string; rewardPoints?: string | number; dailyLimitPerUser?: number; minIntervalSeconds?: number; sessionTtlSeconds?: number }) {
    return this.rewards.updateConfig(admin.id, body)
  }

  @UseGuards(AdminSessionGuard)
  @Get('admin/wechat/reward-events')
  events() {
    return this.rewards.listEvents()
  }
}
