import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common'
import { CurrentAdmin, CurrentUser } from '../../common/current-user'
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
  createPlan(@CurrentAdmin() admin: { id: string }, @Body() body: { name?: string; pointAmount?: string | number; remark?: string }) {
    return this.redeemService.createPlan(admin.id, body)
  }

  @UseGuards(AdminSessionGuard)
  @Post('admin/redeem-codes/batch')
  createCodes(@CurrentAdmin() admin: { id: string }, @Body() body: { planId?: string; count?: number; expiresAt?: string }) {
    return this.redeemService.createCodes(admin.id, String(body.planId || ''), Number(body.count || 1), body.expiresAt)
  }

  @UseGuards(AdminSessionGuard)
  @Get('admin/redeem-codes')
  listCodes() {
    return this.redeemService.listCodes()
  }

  @UseGuards(AdminSessionGuard)
  @Post('admin/redeem-codes/:id/revoke')
  revoke(@CurrentAdmin() admin: { id: string }, @Param('id') id: string) {
    return this.redeemService.revokeCode(admin.id, id)
  }
}
