import { BadRequestException, Body, Controller, Post, Req, Res } from '@nestjs/common'
import { Request, Response } from 'express'
import { ChatImageService } from '../chat/chat-image.service'
import { ChatService } from '../chat/chat.service'
import { WechatService } from '../wechat/wechat.service'

function bearer(req: Request) {
  return String(req.headers.authorization || '').replace(/^Bearer\s+/i, '')
}

@Controller('wechat/miniapp/ai')
export class MiniappAiController {
  constructor(
    private readonly chat: ChatService,
    private readonly chatImage: ChatImageService,
    private readonly wechat: WechatService
  ) {}

  @Post('chat/completions')
  async completions(
    @Req() req: Request,
    @Body()
    body: {
      conversationId?: string
      model?: string
      messages?: Array<{
        role: 'user' | 'assistant' | 'system'
        content: string
        images?: string[]
      }>
    },
    @Res() res: Response
  ) {
    const session = await this.wechat.verifyMiniappSession(bearer(req))
    if (!session.userId) throw new BadRequestException('wechat_not_bound')
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
    res.setHeader('Cache-Control', 'no-cache, no-transform')
    res.setHeader('Connection', 'keep-alive')
    await this.chat.streamCompletion(
      session.userId,
      {
        conversationId: body.conversationId,
        model: String(body.model || ''),
        messages: body.messages || []
      },
      res
    )
  }

  @Post('images/generations')
  async generateImage(
    @Req() req: Request,
    @Body()
    body: {
      conversationId?: string
      model?: string
      prompt?: string
      size?: string
      quality?: 'low' | 'medium' | 'high'
      output_format?: 'png' | 'jpeg' | 'webp'
      output_compression?: number
      moderation?: 'auto' | 'low'
      n?: number
    }
  ) {
    const session = await this.wechat.verifyMiniappSession(bearer(req))
    if (!session.userId) throw new BadRequestException('wechat_not_bound')
    return this.chatImage.generateImage(session.userId, {
      conversationId: body.conversationId,
      model: String(body.model || ''),
      prompt: String(body.prompt || ''),
      size: body.size,
      quality: body.quality,
      output_format: body.output_format,
      output_compression: body.output_compression,
      moderation: body.moderation,
      n: body.n
    })
  }
}
