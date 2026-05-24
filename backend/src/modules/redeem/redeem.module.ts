import { Module } from '@nestjs/common'
import { AdminModule } from '../admin/admin.module'
import { QuotaModule } from '../quota/quota.module'
import { RedeemController } from './redeem.controller'
import { RedeemService } from './redeem.service'

@Module({ imports: [AdminModule, QuotaModule], controllers: [RedeemController], providers: [RedeemService] })
export class RedeemModule {}
