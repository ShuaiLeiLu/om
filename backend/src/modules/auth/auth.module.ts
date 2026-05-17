import { Module } from '@nestjs/common'
import { AdminModule } from '../admin/admin.module'
import { MailerModule } from '../mailer/mailer.module'
import { AuthController } from './auth.controller'
import { AuthService } from './auth.service'
import { EmailVerificationService } from './email-verification.service'
import { LocalAuthService } from './local-auth.service'
import { WechatOauthService } from './wechat-oauth.service'

@Module({
  imports: [AdminModule, MailerModule],
  controllers: [AuthController],
  providers: [AuthService, LocalAuthService, WechatOauthService, EmailVerificationService],
  exports: [AuthService, LocalAuthService, WechatOauthService, EmailVerificationService]
})
export class AuthModule {}
