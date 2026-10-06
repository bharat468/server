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
