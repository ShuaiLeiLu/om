import { Module } from '@nestjs/common'
import { StorageModule } from '../storage/storage.module'
import { ImageUsageService } from './image-usage.service'
import { ImagesController } from './images.controller'
import { ImagesService } from './images.service'

@Module({
  imports: [StorageModule],
  controllers: [ImagesController],
  providers: [ImagesService, ImageUsageService],
  exports: [ImagesService, ImageUsageService]
})
export class ImagesModule {}
