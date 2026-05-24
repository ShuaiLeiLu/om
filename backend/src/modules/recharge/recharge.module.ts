import { Module } from '@nestjs/common'
import { AdminModule } from '../admin/admin.module'
import { QuotaModule } from '../quota/quota.module'
import { RechargeController } from './recharge.controller'
import { RechargeService } from './recharge.service'

@Module({
  imports: [AdminModule, QuotaModule],
  controllers: [RechargeController],
  providers: [RechargeService]
})
export class RechargeModule {}
