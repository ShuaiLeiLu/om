import { BadRequestException, Injectable } from '@nestjs/common'
import { randomToken, sha256 } from '../../common/http'
import { PrismaService } from '../prisma/prisma.service'
import { QuotaService } from '../quota/quota.service'

@Injectable()
export class RedeemService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly quota: QuotaService
  ) {}

  async redeem(userId: string, code: string) {
    const codeHash = sha256(String(code || '').trim().toUpperCase())
    const redeemCode = await this.prisma.redeemCode.findUnique({ where: { codeHash }, include: { plan: true } })
    if (!redeemCode) throw new BadRequestException('redeem_code_invalid')
    if (redeemCode.status === 'used') throw new BadRequestException('redeem_code_used')
    if (redeemCode.status === 'revoked') throw new BadRequestException('redeem_code_revoked')
    if (redeemCode.expiresAt && redeemCode.expiresAt <= new Date()) throw new BadRequestException('redeem_code_expired')
    if (redeemCode.plan.status !== 'active') throw new BadRequestException('plan_disabled')

    await this.prisma.redeemCode.update({
      where: { id: redeemCode.id },
      data: { status: 'used', usedByUserId: userId, usedAt: new Date() }
    })

    return this.quota.grantTokens({
      userId,
      source: 'redeem_code',
      sourceId: redeemCode.id,
      tokens: redeemCode.plan.tokenAmount,
      validDays: redeemCode.plan.validDays,
      ledgerType: 'redeem_code',
      remark: `兑换套餐：${redeemCode.plan.name}`
    })
  }

  async createPlan(input: { name?: string; tokenAmount?: string | number; validDays?: number; remark?: string }) {
    return this.prisma.plan.create({
      data: {
        name: String(input.name || '').trim(),
        tokenAmount: BigInt(input.tokenAmount || 0),
        validDays: Number(input.validDays || 30),
        remark: input.remark || ''
      }
    })
  }

  listPlans() {
    return this.prisma.plan.findMany({ orderBy: { createdAt: 'desc' } })
  }

  async createCodes(planId: string, count: number, expiresAt?: string) {
    const plan = await this.prisma.plan.findUnique({ where: { id: planId } })
    if (!plan) throw new BadRequestException('plan_not_found')
    const plaintextCodes: string[] = []
    for (let i = 0; i < Math.min(1000, Math.max(1, count)); i += 1) {
      const code = `WM-${randomToken(10).toUpperCase()}`
      plaintextCodes.push(code)
      await this.prisma.redeemCode.create({
        data: {
          planId,
          codeHash: sha256(code),
          expiresAt: expiresAt ? new Date(expiresAt) : null
        }
      })
    }
    return { codes: plaintextCodes }
  }

  listCodes() {
    return this.prisma.redeemCode.findMany({ orderBy: { createdAt: 'desc' }, include: { plan: true } })
  }

  revokeCode(id: string) {
    return this.prisma.redeemCode.update({ where: { id }, data: { status: 'revoked', revokedAt: new Date() } })
  }
}
