import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.connectWithRetry()
  }

  async onModuleDestroy() {
    await this.$disconnect()
  }

  private async connectWithRetry() {
    let lastError: unknown
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      try {
        await this.$connect()
        return
      } catch (error) {
        lastError = error
        if (attempt === 5) break
        await new Promise((resolve) => setTimeout(resolve, attempt * 1000))
      }
    }
    throw lastError
  }
}
