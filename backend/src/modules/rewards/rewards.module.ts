import { Module } from '@nestjs/common'
import { AdminModule } from '../admin/admin.module'
import { PointsModule } from '../points/points.module'
import { WechatModule } from '../wechat/wechat.module'
import { RewardsController } from './rewards.controller'
import { RewardsService } from './rewards.service'

@Module({ imports: [AdminModule, PointsModule, WechatModule], controllers: [RewardsController], providers: [RewardsService] })
export class RewardsModule {}
