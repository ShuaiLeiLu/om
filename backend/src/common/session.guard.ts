import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import { PrismaService } from '../modules/prisma/prisma.service'
import { sha256 } from './http'

@Injectable()
export class UserSessionGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest()
    const token = req.cookies?.chatty_session
    if (!token) throw new UnauthorizedException('unauthorized')
    const session = await this.prisma.userSession.findFirst({
      where: { refreshTokenHash: sha256(token), status: 'active', expiresAt: { gt: new Date() } },
      include: { user: true }
    })
    if (!session || session.user.status !== 'active') throw new UnauthorizedException('unauthorized')
    req.user = { id: session.userId, status: session.user.status }
    return true
  }
}

@Injectable()
export class AdminSessionGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest()
    const token = req.cookies?.chatty_admin_session
    if (!token) throw new UnauthorizedException('unauthorized')
    const session = await this.prisma.adminSession.findFirst({
      where: { refreshTokenHash: sha256(token), status: 'active', expiresAt: { gt: new Date() } },
      include: { adminUser: true }
    })
    if (!session || session.adminUser.status !== 'active') throw new UnauthorizedException('unauthorized')
    req.admin = { id: session.adminUserId, role: session.adminUser.role, status: session.adminUser.status }
    return true
  }
}
