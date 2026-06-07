import { Module } from '@nestjs/common'
import { AdminModule } from '../admin/admin.module'
import { PointsModule } from '../points/points.module'
import { Sub2apiService } from './sub2api.service'

@Module({ imports: [AdminModule, PointsModule], providers: [Sub2apiService], exports: [Sub2apiService] })
export class Sub2apiModule {}
