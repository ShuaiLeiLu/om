import { Body, Controller, Get, Param, Patch, Post, Query, Req, Res, UseGuards } from '@nestjs/common'
import { Request, Response } from 'express'
import { CurrentAdmin } from '../../common/current-user'
import { getClientIp, getUserAgent } from '../../common/http'
import { AdminSessionGuard } from '../../common/session.guard'
import { AdminService } from './admin.service'

@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Post('auth/login')
  login(@Body() body: { username?: string; email?: string; password?: string }, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.admin.login(body, res, { ip: getClientIp(req), userAgent: getUserAgent(req) })
  }

  @Post('auth/logout')
  logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.admin.logout(req.cookies?.chatty_admin_session, res)
  }

  @UseGuards(AdminSessionGuard)
  @Get('me')
  me(@CurrentAdmin() admin: { id: string }) {
    return this.admin.me(admin.id)
  }

  @UseGuards(AdminSessionGuard)
  @Get('dashboard')
  dashboard() {
    return this.admin.dashboard()
  }

  @UseGuards(AdminSessionGuard)
  @Get('users')
  users(@Query() query: { q?: string; status?: string; page?: string; pageSize?: string }) {
    return this.admin.listUsers(query)
  }

  @UseGuards(AdminSessionGuard)
  @Post('users/:id/disable')
  disable(@CurrentAdmin() admin: { id: string }, @Param('id') id: string) {
    return this.admin.updateUserStatus(admin.id, id, 'disabled')
  }

  @UseGuards(AdminSessionGuard)
  @Post('users/:id/enable')
  enable(@CurrentAdmin() admin: { id: string }, @Param('id') id: string) {
    return this.admin.updateUserStatus(admin.id, id, 'active')
  }

  @UseGuards(AdminSessionGuard)
  @Post('users/:id/quota-adjust')
  adjustQuota(@CurrentAdmin() admin: { id: string }, @Param('id') id: string, @Body() body: { tokens?: string | number; validDays?: number; remark?: string }) {
    return this.admin.adjustQuota(admin.id, id, body)
  }

  @UseGuards(AdminSessionGuard)
  @Get('llm-requests')
  llmRequests(@Query() query: { userId?: string; status?: string; page?: string; pageSize?: string }) {
    return this.admin.listLlmRequests(query)
  }

  @UseGuards(AdminSessionGuard)
  @Get('quota-ledger')
  quotaLedger(@Query() query: { userId?: string; type?: string; page?: string; pageSize?: string }) {
    return this.admin.listQuotaLedger(query)
  }

  @UseGuards(AdminSessionGuard)
  @Get('audit-logs')
  auditLogs(@Query() query: { adminUserId?: string; action?: string; page?: string; pageSize?: string }) {
    return this.admin.listAuditLogs(query)
  }

  @UseGuards(AdminSessionGuard)
  @Get('wechat/accounts')
  wechatAccounts(@Query() query: { q?: string; page?: string; pageSize?: string }) {
    return this.admin.listWechatAccounts(query)
  }

  @UseGuards(AdminSessionGuard)
  @Post('wechat/accounts/:id/unbind')
  unbindWechat(@CurrentAdmin() admin: { id: string }, @Param('id') id: string) {
    return this.admin.unbindWechatAccount(admin.id, id)
  }
}
