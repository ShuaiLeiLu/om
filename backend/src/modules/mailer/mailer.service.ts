import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import * as nodemailer from 'nodemailer'

type Transporter = nodemailer.Transporter

@Injectable()
export class MailerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MailerService.name)
  private transporter: Transporter | null = null
  private from = ''
  private subjectPrefix = ''

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const host = this.config.get<string>('SMTP_HOST') || ''
    const port = Number(this.config.get<string>('SMTP_PORT') || 465)
    const secure = String(this.config.get<string>('SMTP_SECURE') || 'true') === 'true'
    const user = this.config.get<string>('SMTP_USER') || ''
    const pass = this.config.get<string>('SMTP_PASS') || ''
    this.from = this.config.get<string>('SMTP_FROM') || user
    this.subjectPrefix = this.config.get<string>('SMTP_SUBJECT_PREFIX') || ''

    if (!host || !user || !pass || !this.from) {
      this.logger.warn(
        'SMTP not fully configured — mailer will run in console-only mode. Verification codes will be logged to stdout.'
      )
      return
    }

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
      pool: true,
      maxConnections: 3,
      maxMessages: 50
    })

    this.transporter
      .verify()
      .then(() => this.logger.log(`SMTP transporter ready (${host}:${port})`))
      .catch((err) => this.logger.error(`SMTP verify failed: ${err.message}`))
  }

  async onModuleDestroy() {
    if (this.transporter) {
      try {
        this.transporter.close()
      } catch {}
    }
  }

  /** 是否配置完整、可以真正发邮件。 */
  isReady() {
    return !!this.transporter
  }

  async sendVerificationCode(args: {
    to: string
    code: string
    purpose: 'register' | 'reset_password' | 'bind_email'
    ttlMinutes: number
  }) {
    const purposeText =
      args.purpose === 'register'
        ? '注册账号'
        : args.purpose === 'reset_password'
          ? '重置密码'
          : '绑定邮箱'

    const subject = this.composeSubject(`${purposeText}验证码`)
    const html = renderVerificationEmail({
      purposeText,
      code: args.code,
      ttlMinutes: args.ttlMinutes
    })
    const text = renderVerificationEmailText({
      purposeText,
      code: args.code,
      ttlMinutes: args.ttlMinutes
    })

    await this.send({ to: args.to, subject, html, text })
  }

  private async send(args: { to: string; subject: string; html: string; text: string }) {
    if (!this.transporter) {
      // 未配置 SMTP 时直接打日志，方便本地开发
      this.logger.warn(
        `[mailer:console-only] to=${args.to} subject="${args.subject}"\n${args.text}`
      )
      return
    }
    await this.transporter.sendMail({
      from: this.from,
      to: args.to,
      subject: args.subject,
      html: args.html,
      text: args.text
    })
  }

  private composeSubject(s: string) {
    return this.subjectPrefix ? `【${this.subjectPrefix}】${s}` : s
  }
}

// ---------- 模板 ----------

function renderVerificationEmail(args: { purposeText: string; code: string; ttlMinutes: number }) {
  return `
<!doctype html>
<html><body style="margin:0;padding:24px 0;background:#f5f6fa;font-family:-apple-system,BlinkMacSystemFont,'PingFang SC','Segoe UI',Roboto,'Helvetica Neue',sans-serif;color:#1f2937;">
  <table cellpadding="0" cellspacing="0" align="center" style="max-width:520px;width:90%;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb;">
    <tr><td style="padding:32px 36px;background:linear-gradient(135deg,#6366f1,#a855f7);">
      <div style="color:#ffffff;font-size:14px;letter-spacing:2px;text-transform:uppercase;opacity:0.85;">万模 AI</div>
      <div style="color:#ffffff;font-size:24px;font-weight:600;margin-top:6px;">${args.purposeText}验证码</div>
    </td></tr>
    <tr><td style="padding:32px 36px;">
      <p style="margin:0;font-size:14px;color:#475569;line-height:1.7;">
        你正在万模 AI ${args.purposeText}，请在 ${args.ttlMinutes} 分钟内使用以下验证码完成验证：
      </p>
      <div style="margin:24px 0;padding:20px 24px;text-align:center;background:#f8fafc;border:1px solid #e5e7eb;border-radius:12px;">
        <div style="font-size:36px;font-weight:700;letter-spacing:8px;font-family:'SF Mono',Menlo,Consolas,monospace;color:#6366f1;">${args.code}</div>
      </div>
      <p style="margin:0;font-size:13px;color:#94a3b8;line-height:1.7;">
        如果不是你本人操作，请忽略此邮件，并建议尽快修改密码。验证码不要分享给任何人。
      </p>
    </td></tr>
    <tr><td style="padding:20px 36px 28px;border-top:1px solid #f1f5f9;background:#fafafa;">
      <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.6;">
        此邮件由系统自动发送，请勿直接回复。
      </p>
    </td></tr>
  </table>
</body></html>`.trim()
}

function renderVerificationEmailText(args: {
  purposeText: string
  code: string
  ttlMinutes: number
}) {
  return [
    `【万模 AI】${args.purposeText}验证码`,
    '',
    `验证码：${args.code}`,
    `有效期：${args.ttlMinutes} 分钟`,
    '',
    '如果不是你本人操作，请忽略此邮件。验证码请勿泄露给任何人。'
  ].join('\n')
}
