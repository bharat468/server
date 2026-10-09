import { prisma } from '../../config/database.config.js';

export class LeaseRepository {
  async listForTenant(tenantId) {
    return prisma.lease.findMany({
      where: { tenantId },
      include: {
        property: {
          select: {
            id: true,
            title: true,
            address: true,
            city: true,
            owner: {
              select: { id: true, name: true, mobile: true, email: true },
            },
          },
        },
        unit: true,
        rentRule: true,
        schedules: {
          orderBy: { dueDate: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listForOwner({ propertyId, status, where = {} } = {}) {
    const filter = { ...where };
    if (status && status !== 'ALL') filter.status = status;
    if (propertyId) filter.propertyId = propertyId;

    return prisma.lease.findMany({
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
        unit: true,
        tenant: {
          select: { id: true, name: true, mobile: true, email: true },
        },
        rentRule: true,
        schedules: {
          orderBy: { dueDate: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id) {
    return prisma.lease.findUnique({
      where: { id },
      include: {
        property: true,
        unit: true,
        tenant: {
          select: { id: true, name: true, mobile: true, email: true },
        },
        rentRule: true,
        schedules: {
          orderBy: { dueDate: 'asc' },
        },
      },
    });
  }

  async update(id, data) {
    return prisma.lease.update({
      where: { id },
      data,
      include: {
        rentRule: true,
        schedules: true,
      },
    });
  }

  async updateSchedule(scheduleId, data) {
    return prisma.rentSchedule.update({
      where: { id: scheduleId },
      data,
    });
  }

  async recordSchedulePayment(scheduleId, { amount, paidOn = new Date() }) {
    const schedule = await prisma.rentSchedule.findUnique({
      where: { id: scheduleId },
    });
    if (!schedule) throw new Error('Rent schedule not found');

    const totalPaid = schedule.paidAmount + amount;
    const totalDue = schedule.amount + schedule.penaltyAmount;
    const status = totalPaid >= totalDue ? 'PAID' : 'PARTIALLY_PAID';

    return prisma.rentSchedule.update({
      where: { id: scheduleId },
      data: {
        paidAmount: totalPaid,
        status,
        paidOn: status === 'PAID' ? paidOn : schedule.paidOn,
      },
    });
  }
}

export const leaseRepository = new LeaseRepository();
