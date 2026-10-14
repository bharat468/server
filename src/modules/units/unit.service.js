import { unitRepository } from './unit.repository.js';
import { propertyRepository } from '../properties/property.repository.js';
import { prisma } from '../../config/database.config.js';
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

    if (!payload.unitNumber || !payload.unitNumber.trim()) {
      throw new ApiError(400, 'Unit number is required');
    }
    if (isNaN(parseFloat(payload.rentAmount)) || parseFloat(payload.rentAmount) <= 0) {
      throw new ApiError(400, 'Valid rent amount greater than 0 is required');
    }
    if (payload.depositAmount !== undefined && (isNaN(parseFloat(payload.depositAmount)) || parseFloat(payload.depositAmount) < 0)) {
      throw new ApiError(400, 'Deposit amount cannot be negative');
    }

    return unitRepository.create({
      propertyId: payload.propertyId,
      unitNumber: payload.unitNumber.trim(),
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

  /**
   * Record Utility Sub-Meter Reading (Electricity / Water)
   * -------------------------------------------------------------------------
   * [Hinglish / Hindi-English Explanation]:
   * Unit ka current bijli ya paani meter reading record karta hai:
   * 1. Rate Landlord ki Organization Settings se auto-fetch hoti hai (`electricityRate` / `waterRate`).
   * 2. Units Consumed = currentReading - previousReading.
   * 3. Total Due = consumedUnits * ratePerUnit.
   * 4. Agar attachToPayment true ho toh tenant ke payment me utility amount link ho jati hai.
   */
  async recordMeterReading(unitId, payload, user) {
    const unit = await prisma.unit.findUnique({
      where: { id: unitId },
      include: {
        property: {
          include: {
            organization: true,
          },
        },
        meterReadings: {
          where: { utilityType: payload.utilityType || 'ELECTRICITY' },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!unit) {
      throw new ApiError(404, 'Unit not found');
    }

    const currentReading = parseFloat(payload.currentReading);
    if (isNaN(currentReading) || currentReading < 0) {
      throw new ApiError(400, 'A valid current meter reading (>= 0) is required.');
    }

    // Auto-fetch previous reading if not provided
    const lastReading = unit.meterReadings?.[0];
    const previousReading =
      payload.previousReading !== undefined && !isNaN(parseFloat(payload.previousReading))
        ? parseFloat(payload.previousReading)
        : (lastReading?.currentReading || 0);

    if (currentReading < previousReading) {
      throw new ApiError(400, `Current reading (${currentReading}) cannot be less than previous reading (${previousReading}).`);
    }

    const utilityType = payload.utilityType || 'ELECTRICITY';

    // Fetch rate from Organization settings or fallback
    const org = unit.property?.organization;
    let ratePerUnit;
    if (payload.customRate !== undefined && !isNaN(parseFloat(payload.customRate))) {
      ratePerUnit = parseFloat(payload.customRate);
    } else {
      ratePerUnit = utilityType === 'WATER'
        ? (org?.waterRate ?? 20.0)
        : (org?.electricityRate ?? 9.0);
    }

    const consumedUnits = Math.round((currentReading - previousReading) * 100) / 100;
    const amount = Math.round((consumedUnits * ratePerUnit) * 100) / 100;
    const readingMonth = payload.readingMonth || new Date().toISOString().slice(0, 7);

    const record = await prisma.meterReading.create({
      data: {
        unitId,
        utilityType,
        readingMonth,
        previousReading,
        currentReading,
        consumedUnits,
        ratePerUnit,
        amount,
        status: payload.status || 'BILLED',
        notes: payload.notes || null,
      },
      include: {
        unit: {
          select: {
            id: true,
            unitNumber: true,
            floor: true,
            propertyId: true,
          },
        },
      },
    });

    return record;
  }

  async getMeterReadings(unitId, user) {
    const unit = await prisma.unit.findUnique({
      where: { id: unitId },
      include: {
        property: {
          include: {
            organization: {
              select: {
                id: true,
                name: true,
                electricityRate: true,
                waterRate: true,
              },
            },
          },
        },
      },
    });

    if (!unit) {
      throw new ApiError(404, 'Unit not found');
    }

    const readings = await prisma.meterReading.findMany({
      where: { unitId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return {
      unit: {
        id: unit.id,
        unitNumber: unit.unitNumber,
        propertyTitle: unit.property?.title,
        propertyId: unit.propertyId,
        organizationRates: {
          electricityRate: unit.property?.organization?.electricityRate ?? 9.0,
          waterRate: unit.property?.organization?.waterRate ?? 20.0,
        },
      },
      readings,
    };
  }
}

export const unitService = new UnitService();
