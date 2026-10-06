import { prisma } from '../../config/database.config.js';

export class PaymentRepository {
  async list({ where = {} } = {}) {
    return prisma.payment.findMany({
      where,
      include: {
        tenant: true,
        property: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id) {
    return prisma.payment.findUnique({
      where: { id },
      include: {
        tenant: true,
        property: true,
      },
    });
  }

  async create(data) {
    return prisma.payment.create({
      data,
      include: {
        tenant: true,
        property: true,
      },
    });
  }

  async update(id, data) {
    return prisma.payment.update({
      where: { id },
      data,
      include: {
        tenant: true,
        property: true,
      },
    });
  }

  async delete(id) {
    return prisma.payment.delete({
      where: { id },
    });
  }
}

export const paymentRepository = new PaymentRepository();
