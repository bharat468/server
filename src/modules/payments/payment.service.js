import { paymentRepository } from './payment.repository.js';
import { propertyRepository } from '../properties/property.repository.js';
import { ApiError } from '../../common/errors/apiError.js';
import { getUserScope } from '../../common/utils/scopeHelper.js';

export class PaymentService {
  async listPayments(user) {
    const scope = await getUserScope(user);

    if (scope.isSuperAdmin) {
      return paymentRepository.list();
    }

    if (scope.orgIds.length === 0 && !user?.id) {
      return [];
    }

    const whereProperty = {
      OR: [
        { organizationId: { in: scope.orgIds } },
        { ownerId: user.id },
        { createdById: user.id },
      ],
    };

    if (scope.propertyScope.length > 0) {
      whereProperty.id = { in: scope.propertyScope };
    }

    return paymentRepository.list({
      where: {
        property: whereProperty,
      },
    });
  }

  async getPayment(id, user) {
    const payment = await paymentRepository.findById(id);
    if (!payment) {
      throw new ApiError(404, 'Payment not found');
    }

    if (user) {
      const scope = await getUserScope(user);
      if (!scope.isSuperAdmin && payment.property) {
        const hasAccess =
          payment.property.ownerId === user.id ||
          payment.property.createdById === user.id ||
          scope.orgIds.includes(payment.property.organizationId);

        if (!hasAccess) {
          throw new ApiError(403, 'Access denied: You do not have permission to view this payment.');
        }
      }
    }

    return payment;
  }

  async createPayment(payload, user) {
    if (payload.propertyId && user) {
      const property = await propertyRepository.findById(payload.propertyId);
      if (!property) {
        throw new ApiError(404, 'Target property not found');
      }
      const scope = await getUserScope(user);
      if (!scope.isSuperAdmin) {
        const hasAccess =
          property.ownerId === user.id ||
          property.createdById === user.id ||
          scope.orgIds.includes(property.organizationId);

        if (!hasAccess) {
          throw new ApiError(403, "Access denied: You cannot record payments for another landlord's property.");
        }
      }
    }

    return paymentRepository.create({
      tenantId: payload.tenantId,
      propertyId: payload.propertyId,
      amount: parseFloat(payload.amount),
      month: payload.month,
      status: payload.status || 'PENDING',
      paidOn: payload.paidOn ? new Date(payload.paidOn) : null,
      createdById: user?.id || null,
    });
  }

  async updatePayment(id, payload, user) {
    await this.getPayment(id, user);
    const data = { ...payload, updatedById: user?.id || null };
    if (data.amount !== undefined) data.amount = parseFloat(data.amount);
    if (data.status === 'PAID' && !data.paidOn) {
      data.paidOn = new Date();
    } else if (data.paidOn) {
      data.paidOn = new Date(data.paidOn);
    }
    return paymentRepository.update(id, data);
  }

  async deletePayment(id, user) {
    await this.getPayment(id, user);
    return paymentRepository.delete(id);
  }
}

export const paymentService = new PaymentService();
