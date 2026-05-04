import { BadRequestException, Injectable } from '@nestjs/common'
import { Prisma, QuotaLedgerType, TokenGrantSource } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class QuotaService {
  constructor(private readonly prisma: PrismaService) {}

  async balance(userId: string, tx: Prisma.TransactionClient = this.prisma) {
    const grants = await tx.tokenGrant.findMany({
      where: { userId, status: 'active', expiresAt: { gt: new Date() } },
      select: { remainingTokens: true }
    })
    return grants.reduce((sum, grant) => sum + grant.remainingTokens, BigInt(0))
  }

  async summary(userId: string) {
    const [balance, expiring] = await Promise.all([
      this.balance(userId),
      this.prisma.tokenGrant.aggregate({
        where: {
          userId,
          status: 'active',
          expiresAt: { gt: new Date(), lt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) }
        },
        _sum: { remainingTokens: true }
      })
    ])
    return { tokenBalance: balance.toString(), expiringSoonTokens: (expiring._sum.remainingTokens || 0).toString() }
  }

  ledger(userId: string, query: { page?: string; pageSize?: string }) {
    const page = Math.max(1, Number(query.page || 1))
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize || 20)))
    return this.prisma.quotaLedger.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize
    })
  }

  async grantTokens(input: {
    userId: string
    source: TokenGrantSource
    sourceId?: string
    tokens: bigint
    validDays: number
    ledgerType: QuotaLedgerType
    remark?: string
  }) {
    if (input.tokens <= BigInt(0)) throw new BadRequestException('tokens_required')
    const expiresAt = new Date(Date.now() + input.validDays * 24 * 60 * 60 * 1000)
    return this.prisma.$transaction(async (tx) => {
      const grant = await tx.tokenGrant.create({
        data: {
          userId: input.userId,
          source: input.source,
          sourceId: input.sourceId,
          totalTokens: input.tokens,
          remainingTokens: input.tokens,
          expiresAt
        }
      })
      const balance = await this.balance(input.userId, tx)
      await tx.quotaLedger.create({
        data: {
          userId: input.userId,
          grantId: grant.id,
          type: input.ledgerType,
          deltaTokens: input.tokens,
          balanceAfter: balance,
          relatedId: input.sourceId,
          remark: input.remark || ''
        }
      })
      return { grant, tokenBalance: balance.toString() }
    })
  }

  async consumeTokens(userId: string, tokens: bigint, relatedId: string) {
    if (tokens <= BigInt(0)) return
    await this.prisma.$transaction(async (tx) => {
      await this.consumeTokensInTransaction(tx, userId, tokens, relatedId)
    })
  }

  async consumeTokensInTransaction(tx: Prisma.TransactionClient, userId: string, tokens: bigint, relatedId: string) {
    if (tokens <= BigInt(0)) return
      let remaining = tokens
      const grants = await tx.tokenGrant.findMany({
        where: { userId, status: 'active', remainingTokens: { gt: 0 }, expiresAt: { gt: new Date() } },
        orderBy: [{ expiresAt: 'asc' }, { createdAt: 'asc' }]
      })
      for (const grant of grants) {
        if (remaining <= BigInt(0)) break
        const deduct = grant.remainingTokens < remaining ? grant.remainingTokens : remaining
        remaining -= deduct
        await tx.tokenGrant.update({
          where: { id: grant.id },
          data: {
            remainingTokens: grant.remainingTokens - deduct,
            status: grant.remainingTokens - deduct === BigInt(0) ? 'exhausted' : grant.status
          }
        })
      }
      if (remaining > BigInt(0)) throw new BadRequestException('token_insufficient')
      const balance = await this.balance(userId, tx)
      await tx.quotaLedger.create({
        data: {
          userId,
          type: 'model_usage',
          deltaTokens: -tokens,
          balanceAfter: balance,
          relatedId,
          remark: 'Sub2API usage token consumption'
        }
      })
  }
}
