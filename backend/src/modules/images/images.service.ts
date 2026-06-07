import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { Image, ImageSource } from '@prisma/client'
import { ConfigService } from '@nestjs/config'
import { PrismaService } from '../prisma/prisma.service'
import { MinioService } from '../storage/minio.service'
import { ImageUsageService } from './image-usage.service'
import { normalizeImageContentType, objectKeyForHash, sha256Hex, sniffImageContentType } from './image-hasher'

type UploadFile = {
  buffer: Buffer
  mimetype: string
  size: number
  originalname?: string
}

@Injectable()
export class ImagesService {
  private readonly allowedTypes = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif'])

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly storage: MinioService,
    private readonly imageUsage: ImageUsageService
  ) {}

  async uploadReference(userId: string, file: UploadFile) {
    if (!file?.buffer?.length) throw new BadRequestException('image_required')
    const maxBytes = Number(this.config.get<string>('IMAGE_UPLOAD_MAX_BYTES') || 25 * 1024 * 1024)
    if (file.size > maxBytes) throw new BadRequestException('image_too_large')

    const declared = normalizeImageContentType(file.mimetype || '')
    const sniffed = sniffImageContentType(file.buffer)
    if (!sniffed || (declared && declared !== sniffed) || !this.allowedTypes.has(sniffed)) {
      throw new BadRequestException('invalid_image_type')
    }

    return this.ingestFromBuffer({
      userId,
      buffer: file.buffer,
      contentType: sniffed,
      source: 'upload'
    })
  }

  async ingestFromBuffer(input: { userId: string; buffer: Buffer; contentType: string; source: ImageSource; taskHint?: string }) {
    const hash = sha256Hex(input.buffer)
    const objectKey = objectKeyForHash(hash, input.contentType)
    const bucket = this.storage.bucket()

    // Object storage is outside the DB transaction, so put first and let later GC
    // clean up rare DB-write failures instead of creating DB rows for missing bytes.
    await this.storage.putObject({
      key: objectKey,
      body: input.buffer,
      contentType: input.contentType,
      ifNotExists: true,
      metadata: {
        source: input.source,
        userId: input.userId,
        ...(input.taskHint ? { taskId: input.taskHint } : {})
      }
    })

    const image = await this.prisma.$transaction(async (tx) => {
      const row = await tx.image.upsert({
        where: { hash },
        create: {
          hash,
          bucket,
          objectKey,
          contentType: input.contentType,
          bytes: input.buffer.length,
          source: input.source,
          ownerUserId: input.userId,
          refCount: 1
        },
        update: { refCount: { increment: 1 } }
      })
      await this.imageUsage.retain(input.userId, row.id, row.bytes, tx)
      return row
    })

    return this.toDto(input.userId, image)
  }

  async getForUser(userId: string, imageId: string) {
    const image = await this.assertReadable(userId, imageId)
    return this.toDto(userId, image)
  }

  async referenceBlobForUser(userId: string, imageId: string) {
    const image = await this.assertReadable(userId, imageId)
    const object = await this.storage.getObject(image.objectKey)
    return {
      image,
      buffer: await this.streamToBuffer(object.body),
      contentType: image.contentType || object.contentType
    }
  }

  async rawUrlForUser(userId: string, imageId: string) {
    const image = await this.assertReadable(userId, imageId)
    return this.presign(image.objectKey, image.contentType)
  }

  async usage(userId: string) {
    return this.imageUsage.usage(userId)
  }

  private async assertReadable(userId: string, imageId: string) {
    const image = await this.prisma.image.findUnique({
      where: { id: imageId },
      include: {
        userRefs: { where: { userId }, take: 1 },
        taskOutputs: { where: { task: { userId } }, take: 1 },
        taskInputs: { where: { task: { userId } }, take: 1 }
      }
    })
    if (!image) throw new NotFoundException('image_not_found')
    if (image.ownerUserId === userId || image.userRefs.length || image.taskOutputs.length || image.taskInputs.length) {
      return image
    }
    throw new ForbiddenException('image_forbidden')
  }

  private async streamToBuffer(stream: NodeJS.ReadableStream) {
    const chunks: Buffer[] = []
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    }
    return Buffer.concat(chunks)
  }

  private async toDto(userId: string, image: Pick<Image, 'id' | 'hash' | 'objectKey' | 'contentType' | 'bytes' | 'width' | 'height' | 'createdAt'>) {
    return {
      id: image.id,
      hash: image.hash,
      contentType: image.contentType,
      bytes: image.bytes,
      width: image.width,
      height: image.height,
      url: await this.presign(image.objectKey, image.contentType),
      createdAt: image.createdAt
    }
  }

  private presign(objectKey: string, contentType: string) {
    const ttlSeconds = Number(this.config.get<string>('IMAGE_PRESIGN_TTL_SECONDS') || 21600)
    return this.storage.presignGet(objectKey, {
      ttlSeconds,
      responseContentType: contentType,
      responseDisposition: 'inline'
    })
  }
}
