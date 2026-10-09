import { prisma } from '../../config/database.config.js';

export class MaintenanceRepository {
  async listForTenant(tenantId) {
    return prisma.maintenanceRequest.findMany({
      where: { tenantId },
      include: {
        property: {
          select: { id: true, title: true, address: true, city: true },
        },
        unit: {
          select: { id: true, unitNumber: true, type: true },
        },
        assignedStaff: {
          select: { id: true, name: true, mobile: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listForOwner({ propertyId, status, priority, where = {} } = {}) {
    const filter = { ...where };
    if (status && status !== 'ALL') filter.status = status;
    if (priority && priority !== 'ALL') filter.priority = priority;
    if (propertyId) filter.propertyId = propertyId;

    return prisma.maintenanceRequest.findMany({
      where: filter,
      include: {
        property: {
          select: { id: true, title: true, address: true, city: true, organizationId: true, ownerId: true },
        },
        unit: {
          select: { id: true, unitNumber: true, type: true },
        },
        tenant: {
          select: { id: true, name: true, mobile: true, email: true },
        },
        assignedStaff: {
          select: { id: true, name: true, mobile: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id) {
    return prisma.maintenanceRequest.findUnique({
      where: { id },
      include: {
        property: true,
        unit: true,
        tenant: {
          select: { id: true, name: true, mobile: true, email: true },
        },
        assignedStaff: {
          select: { id: true, name: true, mobile: true, email: true },
        },
      },
    });
  }

  async create(data) {
    return prisma.maintenanceRequest.create({
      data,
      include: {
        property: true,
        unit: true,
      },
    });
  }

  async update(id, data) {
    return prisma.maintenanceRequest.update({
      where: { id },
      data,
      include: {
        property: true,
        unit: true,
        assignedStaff: true,
      },
    });
  }
}

export const maintenanceRepository = new MaintenanceRepository();
