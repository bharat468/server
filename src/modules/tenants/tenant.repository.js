import { prisma } from '../../config/database.config.js';

export class TenantRepository {
  async list({ where = {} } = {}) {
    return prisma.tenant.findMany({
      where,
      include: {
        property: {
          include: {
            units: {
              include: {
                meterReadings: {
                  orderBy: { createdAt: 'desc' },
                },
              },
            },
          },
        },
        payments: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id) {
    return prisma.tenant.findUnique({
      where: { id },
      include: {
        property: {
          include: {
            units: {
              include: {
                meterReadings: {
                  orderBy: { createdAt: 'desc' },
                },
              },
            },
          },
        },
        payments: true,
      },
    });
  }

  async create(data) {
    return prisma.tenant.create({
      data,
      include: {
        property: {
          include: {
            units: {
              include: {
                meterReadings: true,
              },
            },
          },
        },
      },
    });
  }

  async update(id, data) {
    return prisma.tenant.update({
      where: { id },
      data,
      include: {
        property: {
          include: {
            units: {
              include: {
                meterReadings: true,
              },
            },
          },
        },
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
