import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException
} from '@nestjs/common'
import { Request, Response } from 'express'
import * as argon2 from 'argon2'
import { PrismaService } from '../prisma/prisma.service'
import { getClientIp, getUserAgent } from '../../common/http'
import { AdminService } from '../admin/admin.service'
import { AuthService } from './auth.service'

/**
 * 邮箱 + 密码本地账号服务。
 *
 *  - 注册：邮箱 + 密码 → 校验 → argon2 哈希 → 创建 User → 写 cookie session
 *  - 登录：邮箱 + 密码 → 找 user → verify hash → 写 cookie session
 *  - 改密：旧密码校验后写入新哈希
 *
 * 注意：
 *  - 邮箱大小写不敏感，写入时 lowercase + trim。
 *  - 密码不写日志；错误码只暴露 invalid_credentials / email_taken 等粗粒度信息，
 *    防止枚举攻击。
 *  - argon2 已经在 backend/package.json 依赖中。
 */

const PASSWORD_MIN = 8
const PASSWORD_MAX = 128
const EMAIL_RE = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/

@Injectable()
export class LocalAuthService {
  private readonly logger = new Logger(LocalAuthService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
    private readonly admin: AdminService
  ) {}

  async register(args: {
    email: string
    password: string
    displayName?: string
    req: Request
    res: Response
  }) {
    const email = this.normalizeEmail(args.email)
    this.validatePassword(args.password)

    const existing = await this.prisma.user.findUnique({ where: { email } })
    if (existing) throw new BadRequestException('email_taken')

    const passwordHash = await argon2.hash(args.password, { type: argon2.argon2id })

    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        displayName: this.sanitizeDisplayName(args.displayName) || this.displayNameFromEmail(email),
        emailVerifiedAt: null
      }
    })

    await this.auth.createUserSession(user.id, args.res, {
      ip: getClientIp(args.req),
      userAgent: getUserAgent(args.req)
    })

    return this.publicUser(user)
  }

  async login(args: { email: string; password: string; req: Request; res: Response }) {
    const login = String(args.email || '').trim()
    if (!args.password) throw new UnauthorizedException('invalid_credentials')
    const meta = {
      ip: getClientIp(args.req),
      userAgent: getUserAgent(args.req)
    }
    const admin = await this.admin.tryLoginWithIdentifier(login, args.password, args.res, meta)
    if (admin) return { ...admin, type: 'admin' as const }

    const email = this.normalizeEmail(login)

    const user = await this.prisma.user.findUnique({ where: { email } })
    // Time-constant-ish: hash a dummy when missing to avoid login enumeration timing.
    if (!user || !user.passwordHash) {
      try {
        await argon2.verify(
          '$argon2id$v=19$m=65536,t=3,p=4$YWFhYWFhYWFhYWFhYWFhYQ$Y3MmYwBQpCwYAQUyG5YCKqPq6gFAWiyx9rEa3vMq3yU',
          args.password
        )
      } catch {}
      throw new UnauthorizedException('invalid_credentials')
    }
    if (user.status !== 'active') throw new UnauthorizedException('account_disabled')

    const ok = await argon2.verify(user.passwordHash, args.password)
    if (!ok) throw new UnauthorizedException('invalid_credentials')

    await this.auth.createUserSession(user.id, args.res, meta)

    return { ...this.publicUser(user), type: 'user' as const }
  }

  async changePassword(args: {
    userId: string
    oldPassword: string
    newPassword: string
  }) {
    this.validatePassword(args.newPassword)
    if (args.oldPassword === args.newPassword) {
      throw new BadRequestException('new_password_same_as_old')
    }
    const user = await this.prisma.user.findUnique({ where: { id: args.userId } })
    if (!user) throw new UnauthorizedException('unauthorized')

    if (user.passwordHash) {
      const ok = await argon2.verify(user.passwordHash, args.oldPassword)
      if (!ok) throw new UnauthorizedException('invalid_credentials')
    }
    // 如果用户原来是微信注册的（passwordHash 为空），允许直接设密码

    const passwordHash = await argon2.hash(args.newPassword, { type: argon2.argon2id })
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash }
    })
    return { ok: true as const }
  }

  // ---------- helpers ----------

  private normalizeEmail(raw: string): string {
    const v = String(raw || '').trim().toLowerCase()
    if (!v || v.length > 254 || !EMAIL_RE.test(v)) {
      throw new BadRequestException('invalid_email')
    }
    return v
  }

  private validatePassword(pw: string) {
    if (typeof pw !== 'string') throw new BadRequestException('invalid_password')
    if (pw.length < PASSWORD_MIN) throw new BadRequestException('password_too_short')
    if (pw.length > PASSWORD_MAX) throw new BadRequestException('password_too_long')
    // 至少包含一个字母 + 一个数字（不强求大小写或符号，避免太烦）
    if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) {
      throw new BadRequestException('password_too_weak')
    }
  }

  private sanitizeDisplayName(name: string | undefined | null) {
    const v = String(name || '').trim().slice(0, 64)
    return v
  }

  private displayNameFromEmail(email: string) {
    const local = email.split('@')[0] || '用户'
    return local.slice(0, 32)
  }

  private publicUser(user: {
    id: string
    displayName: string
    avatarUrl: string
    email: string | null
    emailVerifiedAt: Date | null
    status: string
  }) {
    return {
      id: user.id,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      email: user.email,
      emailVerified: !!user.emailVerifiedAt,
      status: user.status
    }
  }
}
