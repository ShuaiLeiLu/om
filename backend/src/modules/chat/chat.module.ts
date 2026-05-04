import { Module } from '@nestjs/common'
import { ModelsModule } from '../models/models.module'
import { QuotaModule } from '../quota/quota.module'
import { ChatController } from './chat.controller'
import { ChatService } from './chat.service'

@Module({ imports: [ModelsModule, QuotaModule], controllers: [ChatController], providers: [ChatService] })
export class ChatModule {}
