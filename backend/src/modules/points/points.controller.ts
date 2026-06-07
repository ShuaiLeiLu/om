import { Controller, Get, Query, UseGuards } from '@nestjs/common'
import { CurrentUser } from '../../common/current-user'
import { UserSessionGuard } from '../../common/session.guard'
import { PointsService } from './points.service'

@UseGuards(UserSessionGuard)
@Controller('points')
export class PointsController {
  constructor(private readonly points: PointsService) {}

  @Get('summary')
  summary(@CurrentUser() user: { id: string }) {
    return this.points.summary(user.id)
  }

  @Get('ledger')
  ledger(@CurrentUser() user: { id: string }, @Query() query: { page?: string; pageSize?: string }) {
    return this.points.ledger(user.id, query)
  }
}
