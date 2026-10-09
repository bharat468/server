import { unitRepository } from './unit.repository.js';
import { propertyRepository } from '../properties/property.repository.js';
import { ApiError } from '../../common/errors/apiError.js';
import { getUserScope } from '../../common/utils/scopeHelper.js';

export class UnitService {
  async listUnits(query, user) {
    const scope = await getUserScope(user);

    const where = {};
    if (!scope.isSuperAdmin) {
      where.property = {
        OR: [
          { organizationId: { in: scope.orgIds } },
          { ownerId: user.id },
          { createdById: user.id },
        ],
      };
      if (scope.propertyScope.length > 0) {
        where.propertyId = { in: scope.propertyScope };
      }
    }

    return unitRepository.list({
      propertyId: query.propertyId,
      status: query.status,
      where,
    });
  }

  async getUnit(id, user) {
    const unit = await unitRepository.findById(id);
    if (!unit) {
      throw new ApiError(404, 'Unit not found');
    }

    if (user) {
      const scope = await getUserScope(user);
      if (!scope.isSuperAdmin && unit.property) {
        const hasAccess =
          unit.property.ownerId === user.id ||
          unit.property.createdById === user.id ||
          scope.orgIds.includes(unit.property.organizationId);

        if (!hasAccess) {
          throw new ApiError(403, 'Access denied: You do not have permission to view this unit');
        }
      }
    }

    return unit;
  }

  async createUnit(payload, user) {
    const property = await propertyRepository.findById(payload.propertyId);
    if (!property) {
      throw new ApiError(404, 'Associated property not found');
    }

    const scope = await getUserScope(user);
    if (!scope.isSuperAdmin) {
      const hasAccess =
        property.ownerId === user.id ||
        property.createdById === user.id ||
        scope.orgIds.includes(property.organizationId);

      if (!hasAccess) {
        throw new ApiError(403, 'Access denied: You cannot add units to another owner\'s property');
      }
    }

    return unitRepository.create({
      propertyId: payload.propertyId,
      unitNumber: payload.unitNumber,
      floor: payload.floor ? parseInt(payload.floor, 10) : 1,
      type: payload.type || 'FLAT_2BHK',
      areaSqFt: payload.areaSqFt ? parseFloat(payload.areaSqFt) : null,
      rentAmount: parseFloat(payload.rentAmount),
      depositAmount: payload.depositAmount ? parseFloat(payload.depositAmount) : 0,
      furnishing: payload.furnishing || 'SEMI_FURNISHED',
      status: payload.status || 'VACANT',
    });
  }

  async updateUnit(id, payload, user) {
    await this.getUnit(id, user);

    const data = { ...payload };
    if (data.floor !== undefined) data.floor = parseInt(data.floor, 10);
    if (data.rentAmount !== undefined) data.rentAmount = parseFloat(data.rentAmount);
    if (data.depositAmount !== undefined) data.depositAmount = parseFloat(data.depositAmount);
    if (data.areaSqFt !== undefined) data.areaSqFt = parseFloat(data.areaSqFt);

    return unitRepository.update(id, data);
  }

  async deleteUnit(id, user) {
    await this.getUnit(id, user);
    return unitRepository.delete(id);
  }
}

export const unitService = new UnitService();
