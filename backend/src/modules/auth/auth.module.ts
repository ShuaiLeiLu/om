import { Module } from '@nestjs/common'
import { AdminModule } from '../admin/admin.module'
import { AuthController } from './auth.controller'
import { AuthService } from './auth.service'
import { CasdoorOauthService } from './casdoor-oauth.service'

@Module({
  imports: [AdminModule],
  controllers: [AuthController],
  providers: [AuthService, CasdoorOauthService],
  exports: [AuthService, CasdoorOauthService]
})
export class AuthModule {}
