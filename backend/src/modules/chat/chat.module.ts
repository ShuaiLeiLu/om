import { Module } from '@nestjs/common'
import { ImagesModule } from '../images/images.module'
import { ModelsModule } from '../models/models.module'
import { PointsModule } from '../points/points.module'
import { Sub2apiModule } from '../sub2api/sub2api.module'
import { ChatController } from './chat.controller'
import { ChatImageService } from './chat-image.service'
import { ChatService } from './chat.service'

@Module({
  imports: [ImagesModule, ModelsModule, PointsModule, Sub2apiModule],
  controllers: [ChatController],
  providers: [ChatService, ChatImageService],
  exports: [ChatService, ChatImageService]
})
export class ChatModule {}
