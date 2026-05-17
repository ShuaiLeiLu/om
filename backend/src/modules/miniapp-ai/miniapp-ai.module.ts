import { Module } from '@nestjs/common'
import { ChatModule } from '../chat/chat.module'
import { WechatModule } from '../wechat/wechat.module'
import { MiniappAiController } from './miniapp-ai.controller'

@Module({ imports: [ChatModule, WechatModule], controllers: [MiniappAiController] })
export class MiniappAiModule {}
