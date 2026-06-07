import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { ConfigModule } from '@nestjs/config'
import { ScheduleModule } from '@nestjs/schedule'
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler'
import { CsrfMiddleware } from '../common/csrf.middleware'
import { AdminModule } from './admin/admin.module'
import { AuthModule } from './auth/auth.module'
import { ChatModule } from './chat/chat.module'
import { HealthModule } from './health/health.module'
import { ImagesModule } from './images/images.module'
import { ModelsModule } from './models/models.module'
import { PrismaModule } from './prisma/prisma.module'
import { PointsModule } from './points/points.module'
import { RechargeModule } from './recharge/recharge.module'
import { RedeemModule } from './redeem/redeem.module'
import { RewardsModule } from './rewards/rewards.module'
import { StorageModule } from './storage/storage.module'
import { Sub2apiModule } from './sub2api/sub2api.module'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([
      { name: 'short', ttl: 1_000, limit: 10 },
      { name: 'medium', ttl: 60_000, limit: 120 },
      { name: 'long', ttl: 3_600_000, limit: 2_000 }
    ]),
    PrismaModule,
    HealthModule,
    AuthModule,
    PointsModule,
    ImagesModule,
    RechargeModule,
    RedeemModule,
    ModelsModule,
    ChatModule,
    StorageModule,
    Sub2apiModule,
    RewardsModule,
    AdminModule
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }]
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CsrfMiddleware).forRoutes('*')
  }
}
