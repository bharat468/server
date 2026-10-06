import { tenantRepository } from './tenant.repository.js';
import { propertyRepository } from '../properties/property.repository.js';
import { ApiError } from '../../common/errors/apiError.js';
import { getUserScope } from '../../common/utils/scopeHelper.js';

export class TenantService {
  async listTenants(user) {
    const scope = await getUserScope(user);

    if (scope.isSuperAdmin) {
      return tenantRepository.list();
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

    return tenantRepository.list({
      where: {
        property: whereProperty,
      },
    });
  }

  async getTenant(id, user) {
    const tenant = await tenantRepository.findById(id);
    if (!tenant) {
      throw new ApiError(404, 'Tenant not found');
    }

    if (user) {
      const scope = await getUserScope(user);
      if (!scope.isSuperAdmin && tenant.property) {
        const hasAccess =
          tenant.property.ownerId === user.id ||
          tenant.property.createdById === user.id ||
          scope.orgIds.includes(tenant.property.organizationId);

        if (!hasAccess) {
          throw new ApiError(403, 'Access denied: You do not have permission to view this tenant.');
        }
      }
    }

    return tenant;
  }

  async createTenant(payload, user) {
    if (payload.propertyId && user) {
      const property = await propertyRepository.findById(payload.propertyId);
      if (!property) {
        throw new ApiError(404, 'Selected property not found');
      }
      const scope = await getUserScope(user);
      if (!scope.isSuperAdmin) {
        const hasAccess =
          property.ownerId === user.id ||
          property.createdById === user.id ||
          scope.orgIds.includes(property.organizationId);

        if (!hasAccess) {
          throw new ApiError(403, 'Access denied: You cannot assign tenants to a property you do not manage.');
        }
      }
    }

    const tenant = await tenantRepository.create({
      name: payload.name,
      email: payload.email,
      phone: payload.phone,
      propertyId: payload.propertyId || null,
      leaseStart: payload.leaseStart || null,
      leaseEnd: payload.leaseEnd || null,
      createdById: user?.id || null,
    });

    if (payload.propertyId) {
      await propertyRepository.update(payload.propertyId, { status: 'OCCUPIED' });
    }

    return tenant;
  }

  async updateTenant(id, payload, user) {
    await this.getTenant(id, user);
    return tenantRepository.update(id, {
      ...payload,
      updatedById: user?.id || null,
    });
  }

  async deleteTenant(id, user) {
    await this.getTenant(id, user);
    return tenantRepository.delete(id);
  }
}

export const tenantService = new TenantService();
