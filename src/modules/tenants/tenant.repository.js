import { prisma } from '../../config/database.config.js';

export class TenantRepository {
  async list() {
    return prisma.tenant.findMany({
      include: {
        property: true,
        payments: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id) {
    return prisma.tenant.findUnique({
      where: { id },
      include: {
        property: true,
        payments: true,
      },
    });
  }

  async create(data) {
    return prisma.tenant.create({
      data,
      include: {
        property: true,
      },
    });
  }

  async update(id, data) {
    return prisma.tenant.update({
      where: { id },
      data,
      include: {
        property: true,
      },
    });
  }

  async delete(id) {
    return prisma.tenant.delete({
      where: { id },
    });
  }
}

export const tenantRepository = new TenantRepository();
