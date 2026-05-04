import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common'

export type CurrentUserValue = { id: string; status: string }
export type CurrentAdminValue = { id: string; role: string; status: string }

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): CurrentUserValue => {
  const req = ctx.switchToHttp().getRequest()
  if (!req.user) throw new UnauthorizedException('unauthorized')
  return req.user
})

export const CurrentAdmin = createParamDecorator((_data: unknown, ctx: ExecutionContext): CurrentAdminValue => {
  const req = ctx.switchToHttp().getRequest()
  if (!req.admin) throw new UnauthorizedException('unauthorized')
  return req.admin
})
