import { tenantRepository } from './tenant.repository.js';
import { propertyRepository } from '../properties/property.repository.js';
import { prisma } from '../../config/database.config.js';
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
      if (!scope.isSuperAdmin) {
        if (tenant.property) {
          const hasAccess =
            tenant.property.ownerId === user.id ||
            tenant.property.createdById === user.id ||
            scope.orgIds.includes(tenant.property.organizationId);

          if (!hasAccess) {
            throw new ApiError(403, 'Access denied: You do not have permission to view this tenant.');
          }
        } else {
          const hasAccess = tenant.createdById === user.id;
          if (!hasAccess) {
            throw new ApiError(403, 'Access denied: You do not have permission to view this tenant.');
          }
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

      try {
        let tenantUser = null;
        if (payload.phone) {
          tenantUser = await prisma.user.findUnique({ where: { mobile: payload.phone } });
          if (!tenantUser) {
            tenantUser = await prisma.user.create({
              data: {
                mobile: payload.phone,
                name: payload.name || 'Tenant',
                email: payload.email || null,
                status: 'ACTIVE',
              },
            });
          }
        }

        if (tenantUser) {
          const property = await propertyRepository.findById(payload.propertyId);
          let unit = await prisma.unit.findFirst({ where: { propertyId: payload.propertyId } });
          if (!unit) {
            unit = await prisma.unit.create({
              data: {
                propertyId: payload.propertyId,
                unitNumber: 'Unit 1',
                rentAmount: property?.rent || 15000,
                status: 'OCCUPIED',
              },
            });
          }

          await prisma.lease.create({
            data: {
              propertyId: payload.propertyId,
              unitId: unit.id,
              tenantId: tenantUser.id,
              monthlyRent: property?.rent || 15000,
              securityDeposit: (property?.rent || 15000) * 2,
              startDate: payload.leaseStart ? new Date(payload.leaseStart) : new Date(),
              endDate: payload.leaseEnd ? new Date(payload.leaseEnd) : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
              status: 'ACTIVE',
              rentRule: {
                create: {
                  dueDay: 5,
                  graceDays: 3,
                  penaltyType: 'PER_DAY',
                  penaltyAmount: 100,
                  maxPenaltyCap: 2000,
                },
              },
            },
          });
        }
      } catch (err) {
        console.error('Failed to create lease record for tenant', err);
      }
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
