import { Module } from '@nestjs/common'
import { AdminModule } from '../admin/admin.module'
import { PointsModule } from '../points/points.module'
import { RedeemController } from './redeem.controller'
import { RedeemService } from './redeem.service'

@Module({ imports: [AdminModule, PointsModule], controllers: [RedeemController], providers: [RedeemService] })
export class RedeemModule {}
