import { Module } from '@nestjs/common'
import { AdminModule } from '../admin/admin.module'
import { PointsModule } from '../points/points.module'
import { RechargeController } from './recharge.controller'
import { RechargeService } from './recharge.service'

@Module({
  imports: [AdminModule, PointsModule],
  controllers: [RechargeController],
  providers: [RechargeService]
})
export class RechargeModule {}
