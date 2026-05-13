import { Controller, Get } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PrismaService } from '../prisma/prisma.service'
import { MinioService } from '../storage/minio.service'

@Controller()
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly minio: MinioService
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

    let storage = 'not_configured'
    if (
      this.config.get<string>('MINIO_ENDPOINT') &&
      this.config.get<string>('MINIO_ACCESS_KEY') &&
      this.config.get<string>('MINIO_SECRET_KEY') &&
      this.config.get<string>('MINIO_BUCKET')
    ) {
      const result = await this.minio.checkBucket()
      storage = result.ok ? 'ok' : 'error'
    }

    return {
      ok: database === 'ok',
      version: '0.1.0',
      time: new Date().toISOString(),
      services: { database, sub2api, storage }
    }
  }
}
