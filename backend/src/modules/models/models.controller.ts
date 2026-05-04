import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common'
import { AdminSessionGuard } from '../../common/session.guard'
import { ModelsService } from './models.service'

@Controller()
export class ModelsController {
  constructor(private readonly models: ModelsService) {}

  @Get('models')
  publicModels() {
    return this.models.publicModels()
  }

  @UseGuards(AdminSessionGuard)
  @Get('admin/models')
  adminModels() {
    return this.models.adminModels()
  }

  @UseGuards(AdminSessionGuard)
  @Patch('admin/models/:id')
  update(@Param('id') id: string, @Body() body: { enabled?: boolean; displayName?: string; sortOrder?: number; remark?: string }) {
    return this.models.update(id, body)
  }
}
