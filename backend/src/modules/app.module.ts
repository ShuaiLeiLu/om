import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { ScheduleModule } from '@nestjs/schedule'
import { AdminModule } from './admin/admin.module'
import { AuthModule } from './auth/auth.module'
import { ChatModule } from './chat/chat.module'
import { HealthModule } from './health/health.module'
import { ImagesModule } from './images/images.module'
import { ModelsModule } from './models/models.module'
import { PrismaModule } from './prisma/prisma.module'
import { QuotaModule } from './quota/quota.module'
import { RedeemModule } from './redeem/redeem.module'
import { RewardsModule } from './rewards/rewards.module'
import { StorageModule } from './storage/storage.module'
import { Sub2apiModule } from './sub2api/sub2api.module'
import { WechatModule } from './wechat/wechat.module'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    HealthModule,
    AuthModule,
    WechatModule,
    QuotaModule,
    ImagesModule,
    RedeemModule,
    ModelsModule,
    ChatModule,
    StorageModule,
    Sub2apiModule,
    RewardsModule,
    AdminModule
  ]
})
export class AppModule {}
