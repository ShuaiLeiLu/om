import { BadRequestException, Injectable } from '@nestjs/common'
import { PointLedgerType, Prisma } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'

const RAW_TOKEN_POINT_UNIT = BigInt(1000)
const MODEL_CALL_BASE_POINTS = BigInt(1)

@Injectable()
export class PointsService {
  constructor(private readonly prisma: PrismaService) {}

  async balance(userId: string, tx: Prisma.TransactionClient = this.prisma) {
    const account = await tx.pointAccount.findUnique({
      where: { userId },
      select: { balance: true }
    })
    return account?.balance || BigInt(0)
  }

  async summary(userId: string) {
    const balance = await this.balance(userId)
    return { pointsBalance: balance.toString() }
  }

  ledger(userId: string, query: { page?: string; pageSize?: string }) {
    const page = Math.max(1, Number(query.page || 1))
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize || 20)))
    return this.prisma.pointLedger.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize
    })
  }

  async addPoints(input: {
    userId: string
    points: bigint
    type: PointLedgerType
    relatedId?: string
    remark?: string
  }) {
    return this.prisma.$transaction((tx) =>
      this.changePointsInTransaction(tx, input.userId, input.points, input.type, input.relatedId, input.remark)
    )
  }

  async consumePoints(userId: string, points: bigint, relatedId: string, remark?: string) {
    if (points <= BigInt(0)) return
    await this.prisma.$transaction((tx) =>
      this.consumePointsInTransaction(tx, userId, points, relatedId, remark)
    )
  }

  async consumePointsInTransaction(
    tx: Prisma.TransactionClient,
    userId: string,
    points: bigint,
    relatedId: string,
    remark?: string
  ) {
    if (points <= BigInt(0)) return
    return this.changePointsInTransaction(tx, userId, -points, 'model_usage', relatedId, remark || 'Model usage points consumption')
  }

  async changePointsInTransaction(
    tx: Prisma.TransactionClient,
    userId: string,
    deltaPoints: bigint,
    type: PointLedgerType,
    relatedId?: string,
    remark?: string
  ) {
    if (deltaPoints === BigInt(0) && type !== 'manual_adjustment') {
      throw new BadRequestException('points_required')
    }
    const account = await tx.pointAccount.upsert({
      where: { userId },
      create: { userId, balance: BigInt(0) },
      update: {}
    })
    const nextBalance = account.balance + deltaPoints
    if (nextBalance < BigInt(0)) throw new BadRequestException('points_insufficient')
    const updated = await tx.pointAccount.update({
      where: { userId },
      data: { balance: nextBalance }
    })
    const ledger = await tx.pointLedger.create({
      data: {
        userId,
        type,
        deltaPoints,
        balanceAfter: updated.balance,
        relatedId,
        remark: remark || ''
      }
    })
    return { ledger, pointsBalance: updated.balance.toString() }
  }

  priceModelUsage(input?: {
    promptTokens?: bigint | number
    completionTokens?: bigint | number
    totalTokens?: bigint | number
  }) {
    const promptTokens = this.bigintFrom(input?.promptTokens)
    const completionTokens = this.bigintFrom(input?.completionTokens)
    const providedTotal = this.bigintFrom(input?.totalTokens)
    const totalTokens = providedTotal > BigInt(0) ? providedTotal : promptTokens + completionTokens
    const usagePoints = totalTokens > BigInt(0)
      ? (totalTokens + RAW_TOKEN_POINT_UNIT - BigInt(1)) / RAW_TOKEN_POINT_UNIT
      : BigInt(0)
    return MODEL_CALL_BASE_POINTS + usagePoints
  }

  private bigintFrom(value: bigint | number | undefined) {
    if (typeof value === 'bigint') return value
    if (typeof value === 'number' && Number.isFinite(value)) return BigInt(Math.max(0, Math.floor(value)))
    return BigInt(0)
  }
}
