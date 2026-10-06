import { tenantRepository } from './tenant.repository.js';
import { prisma } from '../../config/database.config.js';
import { ApiError } from '../../common/errors/apiError.js';

export class TenantService {
  async listTenants() {
    return tenantRepository.list();
  }

  async getTenant(id) {
    const tenant = await tenantRepository.findById(id);
    if (!tenant) {
      throw new ApiError(404, 'Tenant not found');
    }
    return tenant;
  }

  async createTenant(payload) {
    return prisma.$transaction(async (tx) => {
      // 1. If propertyId is provided, mark property as OCCUPIED
      if (payload.propertyId) {
        await tx.property.update({
          where: { id: payload.propertyId },
          data: { status: 'OCCUPIED' },
        });
      }

      // 2. Create tenant
      return tx.tenant.create({
        data: {
          name: payload.name,
          email: payload.email,
          phone: payload.phone,
          propertyId: payload.propertyId || null,
          leaseStart: payload.leaseStart || null,
          leaseEnd: payload.leaseEnd || null,
        },
        include: {
          property: true,
        },
      });
    });
  }

  async updateTenant(id, payload) {
    await this.getTenant(id);
    return tenantRepository.update(id, payload);
  }

  async deleteTenant(id) {
    const tenant = await this.getTenant(id);

    // If tenant had a property assigned, check if property should be vacant
    if (tenant.propertyId) {
      await prisma.property.update({
        where: { id: tenant.propertyId },
        data: { status: 'VACANT' },
      });
    }

    return tenantRepository.delete(id);
  }
}

export const tenantService = new TenantService();
