import { BadRequestException, Injectable } from '@nestjs/common'
import { randomToken } from '../../common/http'
import { PrismaService } from '../prisma/prisma.service'
import { QuotaService } from '../quota/quota.service'
import { WechatService } from '../wechat/wechat.service'

@Injectable()
export class RewardsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly quota: QuotaService,
    private readonly wechat: WechatService
  ) {}

  async config(sessionToken: string) {
    const session = await this.wechat.verifyMiniappSession(sessionToken)
    const config = await this.getConfig()
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const claimed = session.userId
      ? await this.prisma.adRewardSession.count({ where: { userId: session.userId, status: 'granted', createdAt: { gte: today } } })
      : 0
    return {
      enabled: config.enabled,
      adUnitId: config.adUnitId,
      rewardTokens: config.rewardTokens.toString(),
      dailyLimitPerUser: config.dailyLimitPerUser,
      remainingToday: Math.max(0, config.dailyLimitPerUser - claimed),
      rewardTokenValidDays: config.rewardTokenValidDays
    }
  }

  async createSession(sessionToken: string) {
    const mini = await this.wechat.verifyMiniappSession(sessionToken)
    if (!mini.userId) throw new BadRequestException('wechat_not_bound')
    const config = await this.getConfig()
    if (!config.enabled) throw new BadRequestException('reward_disabled')
    await this.assertCanClaim(mini.userId, config.dailyLimitPerUser, config.minIntervalSeconds)
    const rewardSessionId = randomToken(24)
    const session = await this.prisma.adRewardSession.create({
      data: {
        rewardSessionId,
        userId: mini.userId,
        openid: mini.openid,
        adUnitId: config.adUnitId,
        rewardTokens: config.rewardTokens,
        expiresAt: new Date(Date.now() + config.sessionTtlSeconds * 1000)
      }
    })
    return { rewardSessionId, adUnitId: config.adUnitId, expiresAt: session.expiresAt }
  }

  async claim(sessionToken: string, rewardSessionId: string) {
    const mini = await this.wechat.verifyMiniappSession(sessionToken)
    if (!mini.userId) throw new BadRequestException('wechat_not_bound')
    const reward = await this.prisma.adRewardSession.findUnique({ where: { rewardSessionId } })
    if (!reward || reward.userId !== mini.userId) throw new BadRequestException('reward_session_not_found')
    if (reward.status === 'granted') return { ok: true, duplicated: true }
    if (reward.expiresAt <= new Date()) throw new BadRequestException('reward_session_expired')
    if (reward.status !== 'pending') throw new BadRequestException('reward_session_consumed')

    const config = await this.getConfig()
    await this.assertCanClaim(mini.userId, config.dailyLimitPerUser, config.minIntervalSeconds)
    const result = await this.quota.grantTokens({
      userId: mini.userId,
      source: 'ad_reward',
      sourceId: reward.rewardSessionId,
      tokens: reward.rewardTokens,
      validDays: config.rewardTokenValidDays,
      ledgerType: 'ad_reward',
      remark: '激励视频广告奖励'
    })
    await this.prisma.adRewardSession.update({
      where: { rewardSessionId },
      data: { status: 'granted', grantedAt: new Date() }
    })
    await this.prisma.adRewardEvent.create({
      data: { rewardSessionId, userId: mini.userId, openid: mini.openid, eventType: 'claim', result: 'granted' }
    })
    return { ok: true, rewardTokens: reward.rewardTokens.toString(), tokenBalance: result.tokenBalance }
  }

  async updateConfig(data: { enabled?: boolean; adUnitId?: string; rewardTokens?: string | number; dailyLimitPerUser?: number; rewardTokenValidDays?: number; minIntervalSeconds?: number; sessionTtlSeconds?: number }) {
    return this.prisma.adRewardConfig.upsert({
      where: { id: 'default' },
      create: { id: 'default', ...this.configData(data) },
      update: this.configData(data)
    })
  }

  listEvents() {
    return this.prisma.adRewardEvent.findMany({ orderBy: { createdAt: 'desc' }, take: 200 })
  }

  private async getConfig() {
    return this.prisma.adRewardConfig.upsert({ where: { id: 'default' }, create: { id: 'default' }, update: {} })
  }

  private async assertCanClaim(userId: string, dailyLimit: number, minIntervalSeconds: number) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const [claimed, latest] = await Promise.all([
      this.prisma.adRewardSession.count({ where: { userId, status: 'granted', createdAt: { gte: today } } }),
      this.prisma.adRewardSession.findFirst({ where: { userId, status: 'granted' }, orderBy: { grantedAt: 'desc' } })
    ])
    if (claimed >= dailyLimit) throw new BadRequestException('reward_daily_limit')
    if (latest?.grantedAt && Date.now() - latest.grantedAt.getTime() < minIntervalSeconds * 1000) {
      throw new BadRequestException('reward_too_frequent')
    }
  }

  private configData(data: { enabled?: boolean; adUnitId?: string; rewardTokens?: string | number; dailyLimitPerUser?: number; rewardTokenValidDays?: number; minIntervalSeconds?: number; sessionTtlSeconds?: number }) {
    return {
      enabled: data.enabled,
      adUnitId: data.adUnitId,
      rewardTokens: data.rewardTokens === undefined ? undefined : BigInt(data.rewardTokens),
      dailyLimitPerUser: data.dailyLimitPerUser,
      rewardTokenValidDays: data.rewardTokenValidDays,
      minIntervalSeconds: data.minIntervalSeconds,
      sessionTtlSeconds: data.sessionTtlSeconds
    }
  }
}
