import { BadRequestException, Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class ModelsService {
  constructor(private readonly prisma: PrismaService) {}

  publicModels() {
    return this.prisma.modelConfig.findMany({ where: { enabled: true }, orderBy: { sortOrder: 'asc' } })
  }

  adminModels() {
    return this.prisma.modelConfig.findMany({ orderBy: { sortOrder: 'asc' } })
  }

  async assertEnabled(sub2apiModel: string) {
    const model = await this.prisma.modelConfig.findUnique({ where: { sub2apiModel } })
    if (!model || !model.enabled) throw new BadRequestException('model_disabled')
    return model
  }

  async update(adminId: string, id: string, data: { enabled?: boolean; displayName?: string; sortOrder?: number; remark?: string }) {
    const before = await this.prisma.modelConfig.findUnique({ where: { id } })
    const model = await this.prisma.modelConfig.update({ where: { id }, data })
    await this.prisma.adminAuditLog.create({
      data: {
        adminUserId: adminId,
        action: 'model_update',
        targetType: 'model_config',
        targetId: id,
        beforeJson: this.auditJson(before),
        afterJson: this.auditJson(model)
      }
    })
    return model
  }

  private auditJson(value: unknown) {
    if (value === null) return undefined
    return JSON.parse(JSON.stringify(value, (_key, item) => (typeof item === 'bigint' ? item.toString() : item)))
  }
}
