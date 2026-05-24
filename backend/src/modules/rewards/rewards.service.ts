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

  async webConfig(userId: string) {
    const config = await this.getConfig()
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const claimed = await this.prisma.adRewardSession.count({
      where: { userId, status: 'granted', createdAt: { gte: today } }
    })
    return {
      enabled: config.enabled,
      adUnitId: config.adUnitId,
      rewardTokens: config.rewardTokens.toString(),
      dailyLimitPerUser: config.dailyLimitPerUser,
      remainingToday: Math.max(0, config.dailyLimitPerUser - claimed),
      rewardTokenValidDays: config.rewardTokenValidDays
    }
  }

  async webCreateSession(userId: string) {
    const config = await this.getConfig()
    if (!config.enabled) throw new BadRequestException('reward_disabled')
    await this.assertCanClaim(userId, config.dailyLimitPerUser, config.minIntervalSeconds)
    const oauth = await this.prisma.oauthAccount.findFirst({ where: { userId, provider: 'wechat' } })
    const openid = oauth?.openid || ''
    const rewardSessionId = randomToken(24)
    const session = await this.prisma.adRewardSession.create({
      data: {
        rewardSessionId,
        userId,
        openid,
        adUnitId: config.adUnitId,
        rewardTokens: config.rewardTokens,
        expiresAt: new Date(Date.now() + config.sessionTtlSeconds * 1000)
      }
    })
    return { rewardSessionId, adUnitId: config.adUnitId, expiresAt: session.expiresAt }
  }

  async webClaim(userId: string, rewardSessionId: string) {
    const reward = await this.prisma.adRewardSession.findUnique({ where: { rewardSessionId } })
    if (!reward || reward.userId !== userId) throw new BadRequestException('reward_session_not_found')
    if (reward.status === 'granted') return { ok: true, duplicated: true }
    if (reward.expiresAt <= new Date()) throw new BadRequestException('reward_session_expired')
    if (reward.status !== 'pending') throw new BadRequestException('reward_session_consumed')

    const config = await this.getConfig()
    await this.assertCanClaim(userId, config.dailyLimitPerUser, config.minIntervalSeconds)
    const result = await this.quota.grantTokens({
      userId,
      source: 'ad_reward',
      sourceId: reward.rewardSessionId,
      tokens: reward.rewardTokens,
      validDays: config.rewardTokenValidDays,
      ledgerType: 'ad_reward',
      remark: '网页视频广告奖励'
    })
    await this.prisma.adRewardSession.update({
      where: { rewardSessionId },
      data: { status: 'granted', grantedAt: new Date() }
    })
    await this.prisma.adRewardEvent.create({
      data: { rewardSessionId, userId, openid: reward.openid, eventType: 'claim', result: 'granted' }
    })
    return { ok: true, rewardTokens: reward.rewardTokens.toString(), tokenBalance: result.tokenBalance.toString() }
  }

  async getCheckinStatus(userId: string) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000)

    const checkins = await this.prisma.quotaLedger.findMany({
      where: {
        userId,
        type: 'manual_adjustment',
        remark: '每日签到'
      },
      orderBy: { createdAt: 'desc' },
      take: 10
    })

    const checkedInToday = checkins.some(c => {
      const cDate = new Date(c.createdAt)
      cDate.setHours(0, 0, 0, 0)
      return cDate.getTime() === today.getTime()
    })

    let streak = 0
    let checkDate = checkedInToday ? today : yesterday

    for (const c of checkins) {
      const cDate = new Date(c.createdAt)
      cDate.setHours(0, 0, 0, 0)
      if (cDate.getTime() === checkDate.getTime()) {
        streak++
        checkDate = new Date(checkDate.getTime() - 24 * 60 * 60 * 1000)
      } else if (cDate.getTime() < checkDate.getTime()) {
        break
      }
    }

    const getRewardForDay = (day: number) => {
      const d = ((day - 1) % 7) + 1
      if (d <= 3) return 100
      if (d <= 5) return 150
      if (d === 6) return 200
      return 500
    }

    const nextReward = getRewardForDay(streak + 1)
    const todayReward = checkedInToday ? 0 : getRewardForDay(streak + 1)

    return {
      checkedInToday,
      streak,
      todayReward,
      nextReward,
      history: checkins.map(c => c.createdAt)
    }
  }

  async performCheckin(userId: string) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const existing = await this.prisma.quotaLedger.findFirst({
      where: {
        userId,
        type: 'manual_adjustment',
        remark: '每日签到',
        createdAt: { gte: today }
      }
    })
    if (existing) {
      throw new BadRequestException('already_checked_in')
    }

    const status = await this.getCheckinStatus(userId)
    const rewardAmount = status.todayReward

    const result = await this.quota.grantTokens({
      userId,
      source: 'manual_adjustment',
      sourceId: 'checkin_' + today.toISOString().split('T')[0],
      tokens: BigInt(rewardAmount),
      validDays: 7,
      ledgerType: 'manual_adjustment',
      remark: '每日签到'
    })

    return {
      ok: true,
      rewardTokens: rewardAmount,
      tokenBalance: result.tokenBalance.toString(),
      streak: status.streak + 1
    }
  }

  async getDailyTasksStatus(userId: string) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const dialogCount = await this.prisma.message.count({
      where: {
        userId,
        role: 'user',
        createdAt: { gte: today }
      }
    })

    const imageCount = await this.prisma.imageTask.count({
      where: {
        userId,
        createdAt: { gte: today }
      }
    })

    const modelGroup = await this.prisma.llmRequest.groupBy({
      by: ['modelId'],
      where: {
        userId,
        createdAt: { gte: today }
      }
    })
    const modelCount = modelGroup.length

    const shared = await this.prisma.quotaLedger.findFirst({
      where: {
        userId,
        type: 'manual_adjustment',
        remark: '分享对话',
        createdAt: { gte: today }
      }
    })

    // Check if task rewards have already been claimed
    const claims = await this.prisma.quotaLedger.findMany({
      where: {
        userId,
        type: 'manual_adjustment',
        remark: { in: ['任务：完成一次对话', '任务：生成一张图片', '任务：切换三个模型', '任务：分享对话'] },
        createdAt: { gte: today }
      }
    })

    const hasClaimed = (remark: string) => claims.some(c => c.remark === remark)

    return {
      dialog: { completed: dialogCount > 0, count: dialogCount, target: 1, reward: 100, claimed: hasClaimed('任务：完成一次对话') },
      image: { completed: imageCount > 0, count: imageCount, target: 1, reward: 150, claimed: hasClaimed('任务：生成一张图片') },
      models: { completed: modelCount >= 3, count: modelCount, target: 3, reward: 200, claimed: hasClaimed('任务：切换三个模型') },
      share: { completed: !!shared, count: shared ? 1 : 0, target: 1, reward: 300, claimed: hasClaimed('任务：分享对话') }
    }
  }

  async claimTaskReward(userId: string, taskType: string) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const status = await this.getDailyTasksStatus(userId)
    let rewardAmount = 0
    let taskRemark = ''

    if (taskType === 'dialog') {
      if (!status.dialog.completed) throw new BadRequestException('task_not_completed')
      rewardAmount = status.dialog.reward
      taskRemark = '任务：完成一次对话'
    } else if (taskType === 'image') {
      if (!status.image.completed) throw new BadRequestException('task_not_completed')
      rewardAmount = status.image.reward
      taskRemark = '任务：生成一张图片'
    } else if (taskType === 'models') {
      if (!status.models.completed) throw new BadRequestException('task_not_completed')
      rewardAmount = status.models.reward
      taskRemark = '任务：切换三个模型'
    } else if (taskType === 'share') {
      // client can trigger share completion directly
      rewardAmount = status.share.reward
      taskRemark = '任务：分享对话'
      
      // Also write down the share action to QuotaLedger first if it didn't exist
      const shared = await this.prisma.quotaLedger.findFirst({
        where: {
          userId,
          type: 'manual_adjustment',
          remark: '分享对话',
          createdAt: { gte: today }
        }
      })
      if (!shared) {
        await this.prisma.quotaLedger.create({
          data: {
            userId,
            type: 'manual_adjustment',
            deltaTokens: 0,
            balanceAfter: 0, // transient
            remark: '分享对话'
          }
        })
      }
    } else {
      throw new BadRequestException('invalid_task_type')
    }

    const existing = await this.prisma.quotaLedger.findFirst({
      where: {
        userId,
        type: 'manual_adjustment',
        remark: taskRemark,
        createdAt: { gte: today }
      }
    })
    if (existing) {
      throw new BadRequestException('task_reward_already_claimed')
    }

    const result = await this.quota.grantTokens({
      userId,
      source: 'manual_adjustment',
      sourceId: `task_${taskType}_` + today.toISOString().split('T')[0],
      tokens: BigInt(rewardAmount),
      validDays: 7,
      ledgerType: 'manual_adjustment',
      remark: taskRemark
    })

    return {
      ok: true,
      rewardTokens: rewardAmount,
      tokenBalance: result.tokenBalance.toString()
    }
  }

  adminConfig() {
    return this.getConfig()
  }

  async updateConfig(adminId: string, data: { enabled?: boolean; adUnitId?: string; rewardTokens?: string | number; dailyLimitPerUser?: number; rewardTokenValidDays?: number; minIntervalSeconds?: number; sessionTtlSeconds?: number }) {
    const before = await this.getConfig()
    const config = await this.prisma.adRewardConfig.upsert({
      where: { id: 'default' },
      create: { id: 'default', ...this.configData(data), updatedByAdminId: adminId },
      update: { ...this.configData(data), updatedByAdminId: adminId }
    })
    await this.prisma.adminAuditLog.create({
      data: {
        adminUserId: adminId,
        action: 'reward_config_update',
        targetType: 'ad_reward_config',
        targetId: config.id,
        beforeJson: this.auditJson(before),
        afterJson: this.auditJson(config)
      }
    })
    return config
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

  private auditJson(value: unknown) {
    if (value === null) return undefined
    return JSON.parse(JSON.stringify(value, (_key, item) => (typeof item === 'bigint' ? item.toString() : item)))
  }
}
