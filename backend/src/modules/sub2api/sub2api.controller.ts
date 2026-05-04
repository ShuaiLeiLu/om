import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common'
import { AdminSessionGuard } from '../../common/session.guard'
import { Sub2apiService } from './sub2api.service'

@UseGuards(AdminSessionGuard)
@Controller('admin')
export class Sub2apiController {
  constructor(private readonly sub2api: Sub2apiService) {}

  @Post('sub2api/sync')
  sync() {
    return this.sub2api.syncUsage()
  }

  @Get('sub2api/sync-status')
  status() {
    return this.sub2api.status()
  }

  @Get('usage-events')
  events() {
    return this.sub2api.events()
  }

  @Post('usage-events/ingest')
  ingest(@Body() body: Record<string, unknown>) {
    return this.sub2api.ingestUsage(body)
  }
}
