import { Body, Controller, Delete, Get, Param, Post, Query, Req, Res, UseGuards } from '@nestjs/common'
import { Request, Response } from 'express'
import { CurrentAdmin } from '../../common/current-user'
import { AdminSessionGuard } from '../../common/session.guard'
import { AdminService } from './admin.service'

@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

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
  @Delete('users/:id')
  deleteUser(@CurrentAdmin() admin: { id: string }, @Param('id') id: string) {
    return this.admin.deleteUser(admin.id, id)
  }

  @UseGuards(AdminSessionGuard)
  @Post('users/:id/points-adjust')
  adjustPoints(@CurrentAdmin() admin: { id: string }, @Param('id') id: string, @Body() body: { points?: string | number; remark?: string }) {
    return this.admin.adjustPoints(admin.id, id, body)
  }

  @UseGuards(AdminSessionGuard)
  @Get('llm-requests')
  llmRequests(@Query() query: { userId?: string; status?: string; page?: string; pageSize?: string }) {
    return this.admin.listLlmRequests(query)
  }

  @UseGuards(AdminSessionGuard)
  @Get('points-ledger')
  pointsLedger(@Query() query: { userId?: string; type?: string; page?: string; pageSize?: string }) {
    return this.admin.listPointLedger(query)
  }

  @UseGuards(AdminSessionGuard)
  @Get('audit-logs')
  auditLogs(@Query() query: { adminUserId?: string; action?: string; page?: string; pageSize?: string }) {
    return this.admin.listAuditLogs(query)
  }

}
