import { Module } from '@nestjs/common'
import { QuotaModule } from '../quota/quota.module'
import { Sub2apiController } from './sub2api.controller'
import { Sub2apiService } from './sub2api.service'

@Module({ imports: [QuotaModule], controllers: [Sub2apiController], providers: [Sub2apiService], exports: [Sub2apiService] })
export class Sub2apiModule {}
