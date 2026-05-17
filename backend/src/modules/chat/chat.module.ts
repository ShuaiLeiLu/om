import { Module } from '@nestjs/common'
import { ImagesModule } from '../images/images.module'
import { ModelsModule } from '../models/models.module'
import { QuotaModule } from '../quota/quota.module'
import { Sub2apiModule } from '../sub2api/sub2api.module'
import { ChatController } from './chat.controller'
import { ChatService } from './chat.service'

@Module({ imports: [ImagesModule, ModelsModule, QuotaModule, Sub2apiModule], controllers: [ChatController], providers: [ChatService], exports: [ChatService] })
export class ChatModule {}
