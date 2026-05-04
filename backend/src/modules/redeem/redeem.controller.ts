import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common'
import { CurrentUser } from '../../common/current-user'
import { UserSessionGuard, AdminSessionGuard } from '../../common/session.guard'
import { RedeemService } from './redeem.service'

@Controller()
export class RedeemController {
  constructor(private readonly redeemService: RedeemService) {}

  @UseGuards(UserSessionGuard)
  @Post('redeem')
  redeem(@CurrentUser() user: { id: string }, @Body() body: { code?: string }) {
    return this.redeemService.redeem(user.id, String(body.code || ''))
  }

  @UseGuards(AdminSessionGuard)
  @Get('admin/plans')
  plans() {
    return this.redeemService.listPlans()
  }

  @UseGuards(AdminSessionGuard)
  @Post('admin/plans')
  createPlan(@Body() body: { name?: string; tokenAmount?: string | number; validDays?: number; remark?: string }) {
    return this.redeemService.createPlan(body)
  }

  @UseGuards(AdminSessionGuard)
  @Post('admin/redeem-codes/batch')
  createCodes(@Body() body: { planId?: string; count?: number; expiresAt?: string }) {
    return this.redeemService.createCodes(String(body.planId || ''), Number(body.count || 1), body.expiresAt)
  }

  @UseGuards(AdminSessionGuard)
  @Get('admin/redeem-codes')
  listCodes() {
    return this.redeemService.listCodes()
  }

  @UseGuards(AdminSessionGuard)
  @Post('admin/redeem-codes/:id/revoke')
  revoke(@Param('id') id: string) {
    return this.redeemService.revokeCode(id)
  }
}
