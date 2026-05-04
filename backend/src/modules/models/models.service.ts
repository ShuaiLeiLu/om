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

  update(id: string, data: { enabled?: boolean; displayName?: string; sortOrder?: number; remark?: string }) {
    return this.prisma.modelConfig.update({ where: { id }, data })
  }
}
