import { Module } from '@nestjs/common'
import { QuotaModule } from '../quota/quota.module'
import { WechatModule } from '../wechat/wechat.module'
import { RewardsController } from './rewards.controller'
import { RewardsService } from './rewards.service'

@Module({ imports: [QuotaModule, WechatModule], controllers: [RewardsController], providers: [RewardsService] })
export class RewardsModule {}
