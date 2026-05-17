import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { randomInt } from 'crypto'
import { PrismaService } from '../prisma/prisma.service'
import { sha256 } from '../../common/http'
import { MailerService } from '../mailer/mailer.service'

type Purpose = 'register' | 'reset_password' | 'bind_email'

/**
 * 邮件验证码服务。
 *
 * 流程：
 *   sendCode(email, purpose, ip)
 *     - 限流：同 email 上次发送 ≥ resendInterval 秒前才允许新发
 *     - 限流：同 IP 1 小时内发送次数 ≤ hourlyLimit
 *     - 生成 6 位数字 → SHA-256 入库 → 调 MailerService 发送
 *
 *   verifyCode(email, purpose, code)
 *     - 找最新的 active 验证码（同 email + purpose）
 *     - attempts < maxAttempts；过期则置 expired；尝试错则 attempts+1
 *     - 命中后 status=consumed，consumedAt=now
 */

@Injectable()
export class EmailVerificationService {
  private readonly logger = new Logger(EmailVerificationService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly mailer: MailerService
  ) {}

  // ---------- 发送 ----------

  async sendCode(args: { email: string; purpose: Purpose; ip?: string; userAgent?: string }) {
    const email = this.normalizeEmail(args.email)
    const purpose = args.purpose
    const ip = String(args.ip || '').slice(0, 64)
    const ua = String(args.userAgent || '').slice(0, 256)

    const now = new Date()
    const resendInterval = Number(this.config.get<string>('EMAIL_VERIFICATION_RESEND_INTERVAL_SECONDS') || 60)
    const hourlyLimit = Number(this.config.get<string>('EMAIL_VERIFICATION_IP_HOURLY_LIMIT') || 20)
    const ttlSeconds = Number(this.config.get<string>('EMAIL_VERIFICATION_TTL_SECONDS') || 600)
    const maxAttempts = Number(this.config.get<string>('EMAIL_VERIFICATION_MAX_ATTEMPTS') || 5)

    // 限流 1：同 email 最近发送
    const latest = await this.prisma.emailVerificationCode.findFirst({
      where: { email, purpose },
      orderBy: { createdAt: 'desc' }
    })
    if (latest && now.getTime() - latest.createdAt.getTime() < resendInterval * 1000) {
      const waitSeconds = Math.ceil(
        (resendInterval * 1000 - (now.getTime() - latest.createdAt.getTime())) / 1000
      )
      throw new BadRequestException({ message: 'send_too_frequent', waitSeconds })
    }

    // 限流 2：单 IP / 小时
    if (ip) {
      const since = new Date(now.getTime() - 60 * 60 * 1000)
      const count = await this.prisma.emailVerificationCode.count({
        where: { ip, createdAt: { gte: since } }
      })
      if (count >= hourlyLimit) {
        throw new BadRequestException('send_rate_limited')
      }
    }

    // 把同 email + purpose 的旧 active 全部失效（避免一个邮箱有 N 个有效码）
    await this.prisma.emailVerificationCode.updateMany({
      where: { email, purpose, status: 'active' },
      data: { status: 'expired' }
    })

    const code = generate6DigitCode()
    const codeHash = sha256(`${email}|${purpose}|${code}`)
    const expiresAt = new Date(now.getTime() + ttlSeconds * 1000)

    await this.prisma.emailVerificationCode.create({
      data: {
        email,
        purpose,
        codeHash,
        status: 'active',
        attempts: 0,
        maxAttempts,
        ip,
        userAgent: ua,
        expiresAt
      }
    })

    try {
      await this.mailer.sendVerificationCode({
        to: email,
        code,
        purpose,
        ttlMinutes: Math.round(ttlSeconds / 60)
      })
    } catch (err) {
      this.logger.error(`Failed to send code email to ${email}: ${(err as Error).message}`)
      // 不抛错给前端（避免泄露邮件服务故障细节，但留 log）
    }

    // 开发模式 / 未配置 SMTP 时，回传一些非敏感信息便于联调
    if (!this.mailer.isReady()) {
      this.logger.warn(`[verification-code:dev] ${email} ${purpose} -> ${code}`)
    }

    return {
      ok: true as const,
      ttlSeconds,
      resendIntervalSeconds: resendInterval
    }
  }

  // ---------- 校验 ----------

  /**
   * @returns 校验通过则返回 true；否则抛 UnauthorizedException('invalid_code')
   */
  async verifyCode(args: { email: string; purpose: Purpose; code: string }) {
    const email = this.normalizeEmail(args.email)
    const code = String(args.code || '').trim()
    if (!/^\d{6}$/.test(code)) throw new UnauthorizedException('invalid_code')

    const codeHash = sha256(`${email}|${args.purpose}|${code}`)
    const now = new Date()

    const record = await this.prisma.emailVerificationCode.findFirst({
      where: { email, purpose: args.purpose, status: 'active' },
      orderBy: { createdAt: 'desc' }
    })
    if (!record) throw new UnauthorizedException('invalid_code')

    if (record.expiresAt <= now) {
      await this.prisma.emailVerificationCode.update({
        where: { id: record.id },
        data: { status: 'expired' }
      })
      throw new UnauthorizedException('code_expired')
    }

    if (record.codeHash !== codeHash) {
      const nextAttempts = record.attempts + 1
      const exhausted = nextAttempts >= record.maxAttempts
      await this.prisma.emailVerificationCode.update({
        where: { id: record.id },
        data: {
          attempts: nextAttempts,
          status: exhausted ? 'exhausted' : 'active'
        }
      })
      if (exhausted) throw new UnauthorizedException('code_exhausted')
      throw new UnauthorizedException('invalid_code')
    }

    await this.prisma.emailVerificationCode.update({
      where: { id: record.id },
      data: { status: 'consumed', consumedAt: now }
    })
    return true
  }

  // ---------- helpers ----------

  private normalizeEmail(raw: string) {
    const v = String(raw || '').trim().toLowerCase()
    if (!v || v.length > 254 || !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(v)) {
      throw new BadRequestException('invalid_email')
    }
    return v
  }
}

function generate6DigitCode() {
  // 0-999999；padStart 保证 6 位
  return String(randomInt(0, 1_000_000)).padStart(6, '0')
}
