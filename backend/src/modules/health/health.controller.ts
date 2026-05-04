import { Controller, Get } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PrismaService } from '../prisma/prisma.service'

@Controller()
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService
  ) {}

  @Get('health')
  async health() {
    let database = 'ok'
    try {
      await this.prisma.$queryRaw`SELECT 1`
    } catch {
      database = 'error'
    }

    let sub2api = 'not_configured'
    const sub2apiBaseUrl = this.config.get<string>('SUB2API_BASE_URL')
    if (sub2apiBaseUrl) {
      try {
        const res = await fetch(`${sub2apiBaseUrl.replace(/\/$/, '')}/health`, { signal: AbortSignal.timeout(3000) })
        sub2api = res.ok ? 'ok' : 'error'
      } catch {
        sub2api = 'error'
      }
    }

    return {
      ok: database === 'ok',
      version: '0.1.0',
      time: new Date().toISOString(),
      services: { database, sub2api }
    }
  }
}
