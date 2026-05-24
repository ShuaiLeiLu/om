import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common'
import { CurrentAdmin, CurrentUser } from '../../common/current-user'
import { AdminSessionGuard, UserSessionGuard } from '../../common/session.guard'
import { RechargeService } from './recharge.service'

@Controller()
export class RechargeController {
  constructor(private readonly recharge: RechargeService) {}

  @Get('recharge/plans')
  plans() {
    return this.recharge.plans()
  }

  @UseGuards(UserSessionGuard)
  @Get('recharge/orders')
  orders(@CurrentUser() user: { id: string }) {
    return this.recharge.listUserOrders(user.id)
  }

  @UseGuards(UserSessionGuard)
  @Post('recharge/orders')
  createOrder(
    @CurrentUser() user: { id: string },
    @Body() body: { planId?: string; paymentMethod?: string }
  ) {
    return this.recharge.createOrder(user.id, body)
  }

  @UseGuards(AdminSessionGuard)
  @Get('admin/recharge-orders')
  adminOrders() {
    return this.recharge.listAdminOrders()
  }

  @UseGuards(AdminSessionGuard)
  @Post('admin/recharge-orders/:id/mark-paid')
  markPaid(@CurrentAdmin() admin: { id: string }, @Body() _body: unknown, @Param('id') id: string) {
    return this.recharge.markPaid(admin.id, id)
  }
}
