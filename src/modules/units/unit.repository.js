import { prisma } from '../../config/database.config.js';

export class UnitRepository {
  async list({ propertyId, status, where = {} } = {}) {
    const filter = { ...where };
    if (propertyId) filter.propertyId = propertyId;
    if (status && status !== 'ALL') filter.status = status;

    return prisma.unit.findMany({
      where: filter,
      include: {
        property: {
          select: {
            id: true,
            title: true,
            address: true,
            city: true,
            organizationId: true,
            ownerId: true,
          },
        },
        listings: {
          where: { isPublished: true },
          take: 1,
        },
        leases: {
          where: { status: 'ACTIVE' },
          include: {
            tenant: {
              select: { id: true, name: true, mobile: true, email: true },
            },
            rentRule: true,
          },
          take: 1,
        },
      },
      orderBy: [{ floor: 'asc' }, { unitNumber: 'asc' }],
    });
  }

  async findById(id) {
    return prisma.unit.findUnique({
      where: { id },
      include: {
        property: true,
        listings: true,
        leases: {
          include: {
            tenant: {
              select: { id: true, name: true, mobile: true, email: true },
            },
            rentRule: true,
            schedules: {
              orderBy: { dueDate: 'asc' },
            },
          },
        },
        maintenanceRequests: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  }

  async create(data) {
    return prisma.unit.create({
      data,
      include: {
        property: true,
      },
    });
  }

  async update(id, data) {
    return prisma.unit.update({
      where: { id },
      data,
      include: {
        property: true,
      },
    });
  }

  async delete(id) {
    return prisma.unit.delete({
      where: { id },
    });
  }
}

export const unitRepository = new UnitRepository();
