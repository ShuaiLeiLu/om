import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Res,
  UploadedFiles,
  UseGuards,
  UseInterceptors
} from '@nestjs/common'
import { FilesInterceptor } from '@nestjs/platform-express'
import { Throttle } from '@nestjs/throttler'
import { Response } from 'express'
import { CurrentUser } from '../../common/current-user'
import { UserSessionGuard } from '../../common/session.guard'
import { ChatImageService } from './chat-image.service'
import { ChatService } from './chat.service'

@UseGuards(UserSessionGuard)
@Controller()
export class ChatController {
  constructor(
    private readonly chat: ChatService,
    private readonly chatImage: ChatImageService
  ) {}

  @Get('conversations')
  conversations(@CurrentUser() user: { id: string }) {
    return this.chat.conversations(user.id)
  }

  @Post('conversations')
  createConversation(
    @CurrentUser() user: { id: string },
    @Body() body: { title?: string; defaultModelId?: string }
  ) {
    return this.chat.createConversation(user.id, body)
  }

  @Get('conversations/:id/messages')
  messages(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.chat.messages(user.id, id)
  }

  @Throttle({ medium: { limit: 30, ttl: 60_000 } })
  @Post('chat/completions')
  async completions(
    @CurrentUser() user: { id: string },
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
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
    res.setHeader('Cache-Control', 'no-cache, no-transform')
    res.setHeader('Connection', 'keep-alive')
    await this.chat.streamCompletion(
      user.id,
      {
        conversationId: body.conversationId,
        model: String(body.model || ''),
        messages: body.messages || []
      },
      res
    )
  }

  @Throttle({ medium: { limit: 10, ttl: 60_000 } })
  @Post('images/generations')
  generateImage(
    @CurrentUser() user: { id: string },
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
    return this.chatImage.generateImage(user.id, {
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

  @Get('images/generated/:token')
  generatedImage(
    @CurrentUser() user: { id: string },
    @Param('token') token: string,
    @Res() res: Response
  ) {
    const image = this.chatImage.generatedImageForUser(user.id, token)
    res.setHeader('Content-Type', image.contentType)
    res.setHeader('Cache-Control', 'private, max-age=1800')
    res.send(image.buffer)
  }

  @Throttle({ medium: { limit: 10, ttl: 60_000 } })
  @Post('images/edits')
  @UseInterceptors(
    FilesInterceptor('images', 16, {
      // 25 MB per file matches MAX_REFERENCE_IMAGE_BYTES; the service still re-validates.
      limits: { fileSize: 25 * 1024 * 1024, files: 16 }
    })
  )
  editImage(
    @CurrentUser() user: { id: string },
    @Body()
    body: {
      conversationId?: string
      model?: string
      prompt?: string
      images?: string[]
      imageIds?: string | string[]
      size?: string
      quality?: 'low' | 'medium' | 'high'
      output_format?: 'png' | 'jpeg' | 'webp'
      output_compression?: number | string
      moderation?: 'auto' | 'low'
      n?: number | string
    },
    @UploadedFiles() files?: Express.Multer.File[]
  ) {
    const uploaded = Array.isArray(files) ? files : []
    const decodedImages = uploaded.map((file) => {
      if (!file.mimetype?.startsWith('image/')) {
        throw new BadRequestException('invalid_reference_image')
      }
      return { buffer: file.buffer, contentType: file.mimetype }
    })
    return this.chatImage.editImage(user.id, {
      conversationId: body.conversationId,
      model: String(body.model || ''),
      prompt: String(body.prompt || ''),
      images: decodedImages.length === 0 && Array.isArray(body.images) ? body.images : [],
      imageIds: this.parseStringList(body.imageIds),
      decodedImages,
      size: body.size,
      quality: body.quality,
      output_format: body.output_format,
      output_compression:
        body.output_compression != null && body.output_compression !== ''
          ? Number(body.output_compression)
          : undefined,
      moderation: body.moderation,
      n: body.n != null && body.n !== '' ? Number(body.n) : undefined
    })
  }

  private parseStringList(value: string | string[] | undefined): string[] {
    if (!value) return []
    if (Array.isArray(value)) return value.filter(Boolean).map(String)
    // multipart often delivers repeated fields as a single string; tolerate JSON or comma-separated.
    const trimmed = String(value).trim()
    if (!trimmed) return []
    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed)
        return Array.isArray(parsed) ? parsed.filter(Boolean).map(String) : []
      } catch {
        return []
      }
    }
    return trimmed.split(',').map((s) => s.trim()).filter(Boolean)
  }
}
