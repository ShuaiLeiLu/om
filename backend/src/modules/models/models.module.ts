import { Module } from '@nestjs/common'
import { AdminModule } from '../admin/admin.module'
import { ModelsController } from './models.controller'
import { ModelsService } from './models.service'

@Module({ imports: [AdminModule], controllers: [ModelsController], providers: [ModelsService], exports: [ModelsService] })
export class ModelsModule {}
