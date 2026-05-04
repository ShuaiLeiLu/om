import { Controller, Get, Query, UseGuards } from '@nestjs/common'
import { CurrentUser } from '../../common/current-user'
import { UserSessionGuard } from '../../common/session.guard'
import { QuotaService } from './quota.service'

@UseGuards(UserSessionGuard)
@Controller('quota')
export class QuotaController {
  constructor(private readonly quota: QuotaService) {}

  @Get('summary')
  summary(@CurrentUser() user: { id: string }) {
    return this.quota.summary(user.id)
  }

  @Get('ledger')
  ledger(@CurrentUser() user: { id: string }, @Query() query: { page?: string; pageSize?: string }) {
    return this.quota.ledger(user.id, query)
  }
}
