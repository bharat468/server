import { paymentRepository } from './payment.repository.js';
import { prisma } from '../../config/database.config.js';
import { ApiError } from '../../common/errors/apiError.js';

export class PaymentService {
  async listPayments() {
    return paymentRepository.list();
  }

  async getPayment(id) {
    const payment = await paymentRepository.findById(id);
    if (!payment) {
      throw new ApiError(404, 'Payment record not found');
    }
    return payment;
  }

  async createPayment(payload) {
    let propertyId = payload.propertyId;

    // If propertyId not provided directly, lookup from tenant
    if (!propertyId && payload.tenantId) {
      const tenant = await prisma.tenant.findUnique({
        where: { id: payload.tenantId },
      });
      if (tenant?.propertyId) {
        propertyId = tenant.propertyId;
      }
    }

    if (!propertyId) {
      throw new ApiError(400, 'A valid property must be associated with the payment or tenant');
    }

    const data = {
      tenantId: payload.tenantId,
      propertyId,
      amount: parseFloat(payload.amount),
      month: payload.month,
      status: payload.status || 'PENDING',
      paidOn: payload.paidOn ? new Date(payload.paidOn) : (payload.status === 'PAID' ? new Date() : null),
    };

    return paymentRepository.create(data);
  }

  async updatePayment(id, payload) {
    await this.getPayment(id);

    const data = { ...payload };

    if (data.amount !== undefined) {
      data.amount = parseFloat(data.amount);
    }

    if (data.status === 'PAID' && !data.paidOn) {
      data.paidOn = new Date();
    } else if (data.paidOn !== undefined) {
      data.paidOn = data.paidOn ? new Date(data.paidOn) : null;
    }

    return paymentRepository.update(id, data);
  }

  async deletePayment(id) {
    await this.getPayment(id);
    return paymentRepository.delete(id);
  }
}

export const paymentService = new PaymentService();
