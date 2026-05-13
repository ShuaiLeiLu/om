import { Injectable } from '@nestjs/common'
import { Prisma, PrismaClient } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'

type Tx = Prisma.TransactionClient | PrismaService | PrismaClient

@Injectable()
export class ImageQuotaService {
  constructor(private readonly prisma: PrismaService) {}

  async retain(userId: string, imageId: string, bytes: number, tx: Tx = this.prisma) {
    const existing = await tx.userImageRef.findUnique({
      where: { userId_imageId: { userId, imageId } }
    })

    if (existing) {
      await tx.userImageRef.update({
        where: { userId_imageId: { userId, imageId } },
        data: { count: { increment: 1 } }
      })
      return
    }

    await tx.userImageRef.create({ data: { userId, imageId, bytes, count: 1 } })
    await tx.storageUsage.upsert({
      where: { userId },
      create: { userId, bytesTotal: BigInt(bytes), imagesCount: 1 },
      update: { bytesTotal: { increment: BigInt(bytes) }, imagesCount: { increment: 1 } }
    })
  }

  async release(userId: string, imageId: string, tx: Tx = this.prisma) {
    const existing = await tx.userImageRef.findUnique({
      where: { userId_imageId: { userId, imageId } }
    })
    if (!existing) return

    if (existing.count > 1) {
      await tx.userImageRef.update({
        where: { userId_imageId: { userId, imageId } },
        data: { count: { decrement: 1 } }
      })
      return
    }

    await tx.userImageRef.delete({ where: { userId_imageId: { userId, imageId } } })
    await tx.storageUsage.upsert({
      where: { userId },
      create: { userId, bytesTotal: BigInt(0), imagesCount: 0 },
      update: { bytesTotal: { decrement: BigInt(existing.bytes) }, imagesCount: { decrement: 1 } }
    })
  }

  async usage(userId: string) {
    const usage = await this.prisma.storageUsage.findUnique({ where: { userId } })
    return {
      bytesTotal: (usage?.bytesTotal || BigInt(0)).toString(),
      bytesLimit: this.defaultLimit().toString(),
      imagesCount: usage?.imagesCount || 0
    }
  }

  private defaultLimit() {
    return BigInt(process.env.IMAGE_USER_STORAGE_DEFAULT_BYTES || 0)
  }
}
