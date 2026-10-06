import { prisma } from '../../config/database.config.js';

export class PropertyRepository {
  async list({ status } = {}) {
    return prisma.property.findMany({
      where: status && status !== 'ALL' ? { status } : {},
      include: {
        tenants: true,
        payments: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id) {
    return prisma.property.findUnique({
      where: { id },
      include: {
        tenants: true,
        payments: true,
      },
    });
  }

  async create(data) {
    return prisma.property.create({
      data,
    });
  }

  async update(id, data) {
    return prisma.property.update({
      where: { id },
      data,
    });
  }

  async delete(id) {
    return prisma.property.delete({
      where: { id },
    });
  }
}

export const propertyRepository = new PropertyRepository();
