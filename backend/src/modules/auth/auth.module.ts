import { Module } from '@nestjs/common'
import { AdminModule } from '../admin/admin.module'
import { AuthController } from './auth.controller'
import { AuthService } from './auth.service'
import { LocalAuthService } from './local-auth.service'
import { WechatOauthService } from './wechat-oauth.service'

@Module({
  imports: [AdminModule],
  controllers: [AuthController],
  providers: [AuthService, LocalAuthService, WechatOauthService],
  exports: [AuthService, LocalAuthService, WechatOauthService]
})
export class AuthModule {}
