import { Controller, Get, Param, Post, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { memoryStorage } from 'multer'
import { Response } from 'express'
import { CurrentUser } from '../../common/current-user'
import { UserSessionGuard } from '../../common/session.guard'
import { ImagesService } from './images.service'

@UseGuards(UserSessionGuard)
@Controller('images')
export class ImagesController {
  constructor(private readonly images: ImagesService) {}

  @Post('uploads')
  @UseInterceptors(FileInterceptor('file', {
    storage: memoryStorage(),
    limits: { fileSize: 25 * 1024 * 1024, files: 1 }
  }))
  upload(@CurrentUser() user: { id: string }, @UploadedFile() file: Express.Multer.File) {
    return this.images.uploadReference(user.id, file)
  }

  @Get('usage')
  usage(@CurrentUser() user: { id: string }) {
    return this.images.usage(user.id)
  }

  @Get(':id')
  get(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.images.getForUser(user.id, id)
  }

  @Get(':id/raw')
  async raw(@CurrentUser() user: { id: string }, @Param('id') id: string, @Res() res: Response) {
    const image = await this.images.blobForUser(user.id, id)
    res.setHeader('Content-Type', image.contentType)
    res.setHeader('Cache-Control', 'private, max-age=1800')
    res.send(image.buffer)
  }
}
