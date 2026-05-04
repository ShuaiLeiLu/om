import { Body, Controller, Get, Param, Post, Res, UseGuards } from '@nestjs/common'
import { Response } from 'express'
import { CurrentUser } from '../../common/current-user'
import { UserSessionGuard } from '../../common/session.guard'
import { ChatService } from './chat.service'

@UseGuards(UserSessionGuard)
@Controller()
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  @Get('conversations')
  conversations(@CurrentUser() user: { id: string }) {
    return this.chat.conversations(user.id)
  }

  @Post('conversations')
  createConversation(@CurrentUser() user: { id: string }, @Body() body: { title?: string; defaultModelId?: string }) {
    return this.chat.createConversation(user.id, body)
  }

  @Get('conversations/:id/messages')
  messages(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.chat.messages(user.id, id)
  }

  @Post('chat/completions')
  async completions(
    @CurrentUser() user: { id: string },
    @Body() body: { conversationId?: string; model?: string; messages?: Array<{ role: 'user' | 'assistant' | 'system'; content: string; images?: string[] }> },
    @Res() res: Response
  ) {
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
    res.setHeader('Cache-Control', 'no-cache, no-transform')
    res.setHeader('Connection', 'keep-alive')
    await this.chat.streamCompletion(user.id, { conversationId: body.conversationId, model: String(body.model || ''), messages: body.messages || [] }, res)
  }

  @Post('images/generations')
  generateImage(
    @CurrentUser() user: { id: string },
    @Body() body: { conversationId?: string; model?: string; prompt?: string; size?: string; n?: number }
  ) {
    return this.chat.generateImage(user.id, {
      conversationId: body.conversationId,
      model: String(body.model || ''),
      prompt: String(body.prompt || ''),
      size: body.size,
      n: body.n
    })
  }
}
