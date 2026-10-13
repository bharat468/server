import { prisma } from '../../config/database.config.js';
import { propertyRepository } from './property.repository.js';
import { ApiError } from '../../common/errors/apiError.js';
import { getUserScope } from '../../common/utils/scopeHelper.js';

export class PropertyService {
  async listProperties(query = {}, user) {
    const scope = await getUserScope(user);

    // Platform SuperAdmin can view all or filter by query.organizationId
    if (scope.isSuperAdmin && !query.isolated) {
      const where = query.organizationId ? { organizationId: query.organizationId } : {};
      return propertyRepository.list({ status: query.status, where });
    }

    // Strict Landlord Multi-Tenant Boundary:
    // If user has no organization or property ownership, return empty list
    if (scope.orgIds.length === 0 && !user?.id) {
      return [];
    }

    const whereConditions = [
      {
        OR: [
          { organizationId: { in: scope.orgIds } },
          { ownerId: user.id },
          { createdById: user.id },
        ],
      },
    ];

    // If staff member has restricted property scope
    if (scope.propertyScope.length > 0) {
      whereConditions.push({ id: { in: scope.propertyScope } });
    }

    return propertyRepository.list({
      status: query.status,
      where: { AND: whereConditions },
    });
  }

  async getProperty(id, user) {
    const property = await propertyRepository.findById(id);
    if (!property) {
      throw new ApiError(404, 'Property not found');
    }

    if (user) {
      const scope = await getUserScope(user);
      if (!scope.isSuperAdmin) {
        const hasAccess =
          property.ownerId === user.id ||
          property.createdById === user.id ||
          scope.orgIds.includes(property.organizationId);

        if (!hasAccess) {
          throw new ApiError(403, 'Access denied: You do not have permission to view this property.');
        }

        if (scope.propertyScope.length > 0 && !scope.propertyScope.includes(property.id)) {
          throw new ApiError(403, 'Access denied: You do not have permission for this specific building.');
        }
      }
    }

    return property;
  }

  async createProperty(payload, user) {
    const scope = await getUserScope(user);
    const targetOrgId = payload.organizationId || scope.primaryOrgId;

    // Real-Life SaaS Guard: Check subscription validity & plan quotas for non-superadmins
    if (targetOrgId && !scope.isSuperAdmin) {
      const subscription = await prisma.subscription.findFirst({
        where: { organizationId: targetOrgId },
        include: { plan: true },
        orderBy: { createdAt: 'desc' },
      });

      if (subscription) {
        const now = new Date();
        const isExpired =
          subscription.status === 'EXPIRED' ||
          (subscription.endDate && new Date(subscription.endDate) < now) ||
          (subscription.expiresAt && new Date(subscription.expiresAt) < now);

        if (isExpired) {
          throw new ApiError(
            403,
            'Subscription Expired: Your organization subscription has expired. Please renew your plan to add new properties.'
          );
        }

        if (subscription.plan && subscription.plan.maxProperties > 0) {
          const currentCount = await prisma.property.count({
            where: { organizationId: targetOrgId },
          });

          if (currentCount >= subscription.plan.maxProperties) {
            throw new ApiError(
              403,
              `Plan Quota Limit Reached: Your current plan (${subscription.plan.name}) allows a maximum of ${subscription.plan.maxProperties} properties. Please upgrade your plan to add more properties.`
            );
          }
        }
      }
    }

    if (!payload.title || !payload.title.trim()) {
      throw new ApiError(400, 'Property title is required');
    }
    if (!payload.address || !payload.address.trim()) {
      throw new ApiError(400, 'Property address is required');
    }
    if (!payload.city || !payload.city.trim()) {
      throw new ApiError(400, 'City is required');
    }
    if (isNaN(parseFloat(payload.rent)) || parseFloat(payload.rent) <= 0) {
      throw new ApiError(400, 'Valid rental amount greater than 0 is required');
    }
    if (payload.bedrooms !== undefined && (isNaN(parseInt(payload.bedrooms, 10)) || parseInt(payload.bedrooms, 10) < 0)) {
      throw new ApiError(400, 'Bedrooms count cannot be negative');
    }

    return propertyRepository.create({
      title: payload.title,
      address: payload.address,
      city: payload.city,
      rent: parseFloat(payload.rent),
      bedrooms: parseInt(payload.bedrooms || 1, 10),
      status: payload.status || 'VACANT',
      organizationId: targetOrgId,
      ownerId: payload.ownerId || user?.id || null,
      createdById: user?.id || null,
    });
  }

  async updateProperty(id, payload, user) {
    await this.getProperty(id, user);
    const data = { ...payload, updatedById: user?.id || null };
    if (data.rent !== undefined) data.rent = parseFloat(data.rent);
    if (data.bedrooms !== undefined) data.bedrooms = parseInt(data.bedrooms, 10);
    return propertyRepository.update(id, data);
  }

  async deleteProperty(id, user) {
    await this.getProperty(id, user);
    return propertyRepository.delete(id);
  }
}

export const propertyService = new PropertyService();
