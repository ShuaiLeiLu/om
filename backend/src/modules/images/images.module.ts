import { Module } from '@nestjs/common'
import { StorageModule } from '../storage/storage.module'
import { ImageQuotaService } from './image-quota.service'
import { ImagesController } from './images.controller'
import { ImagesService } from './images.service'

@Module({
  imports: [StorageModule],
  controllers: [ImagesController],
  providers: [ImagesService, ImageQuotaService],
  exports: [ImagesService, ImageQuotaService]
})
export class ImagesModule {}
