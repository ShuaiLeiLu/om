import { Module } from '@nestjs/common'
import { AdminModule } from '../admin/admin.module'
import { QuotaModule } from '../quota/quota.module'
import { WechatModule } from '../wechat/wechat.module'
import { RewardsController } from './rewards.controller'
import { RewardsService } from './rewards.service'

@Module({ imports: [AdminModule, QuotaModule, WechatModule], controllers: [RewardsController], providers: [RewardsService] })
export class RewardsModule {}
