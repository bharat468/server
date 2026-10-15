import { prisma } from '../../config/database.config.js';
import { leaseRepository } from './lease.repository.js';
import { ApiError } from '../../common/errors/apiError.js';
import { getUserScope } from '../../common/utils/scopeHelper.js';

export class LeaseService {
  async listMyRentals(user) {
    const leases = await leaseRepository.listForTenant(user.id);
    // Automatically evaluate overdue penalties for the tenant's view
    for (const lease of leases) {
      if (lease.rentRule && lease.schedules) {
        await this.evaluateSchedulesPenalty(lease);
      }
    }
    return leaseRepository.listForTenant(user.id);
  }

  async listOwnerLeases(query, user) {
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

    return leaseRepository.listForOwner({
      propertyId: query.propertyId,
      status: query.status,
      where,
    });
  }

  async getLease(id, user) {
    const lease = await leaseRepository.findById(id);
    if (!lease) {
      throw new ApiError(404, 'Lease contract not found');
    }

    if (user) {
      const scope = await getUserScope(user);
      const isTenant = lease.tenantId === user.id;
      const isOwnerOrSuper =
        scope.isSuperAdmin ||
        lease.property.ownerId === user.id ||
        lease.property.createdById === user.id ||
        scope.orgIds.includes(lease.property.organizationId);

      if (!isTenant && !isOwnerOrSuper) {
        throw new ApiError(403, 'Access denied: You do not have permission to view this lease');
      }
    }

    if (lease.rentRule && lease.schedules) {
      await this.evaluateSchedulesPenalty(lease);
      return leaseRepository.findById(id);
    }

    return lease;
  }

  /**
   * --------------------------------------------------------------------------
   * evaluateSchedulesPenalty(lease)
   * --------------------------------------------------------------------------
   * Function Purpose:
   * Deterministic Penalty Calculation Engine (BRD Section 13 & 14):
   * 1. Lease ke rentRule (graceDays, penaltyType, penaltyAmount, maxPenaltyCap) ko evaluate karta hai.
   * 2. Agar current date > (dueDate + graceDays) hai:
   *    - overdue days = today - dueDate.
   *    - Penalty calculate hoti hai ('PER_DAY', 'FIXED', ya 'PERCENTAGE').
   *    - Maximum penalty cap ceiling lagti hai (maxPenaltyCap se zyada penalty kabhi nahi lagti).
   *    - Schedule status 'OVERDUE' update hota hai.
   * 3. Agar dueDate aa gayi hai lekin graceDays ke andar hai -> status 'DUE' banta hai (no penalty).
   * 
   * @param {Object} lease - Lease with rentRule & schedules
   */
  async evaluateSchedulesPenalty(lease) {
    const rule = lease.rentRule;
    if (!rule) return;

    const today = new Date();

    for (const schedule of lease.schedules) {
      // Only evaluate unpaid / upcoming / due schedules
      if (schedule.status === 'PAID') continue;

      const dueDate = new Date(schedule.dueDate);
      const gracePeriodEnd = new Date(dueDate);
      gracePeriodEnd.setDate(gracePeriodEnd.getDate() + (rule.graceDays || 0));

      if (today > gracePeriodEnd) {
        // Calculate days late past the due date
        const diffTime = today.getTime() - dueDate.getTime();
        const daysLate = Math.max(1, Math.floor(diffTime / (1000 * 60 * 60 * 24)));

        let penalty = 0;
        if (rule.penaltyType === 'PER_DAY') {
          penalty = daysLate * rule.penaltyAmount;
        } else if (rule.penaltyType === 'FIXED') {
          penalty = rule.penaltyAmount;
        } else if (rule.penaltyType === 'PERCENTAGE') {
          penalty = (rule.penaltyAmount / 100) * schedule.amount;
        }

        // Apply Maximum Penalty Cap
        if (rule.maxPenaltyCap > 0 && penalty > rule.maxPenaltyCap) {
          penalty = rule.maxPenaltyCap;
        }

        // If penalty or status changed, persist it
        if (schedule.penaltyAmount !== penalty || schedule.status !== 'OVERDUE') {
          await leaseRepository.updateSchedule(schedule.id, {
            penaltyAmount: penalty,
            status: 'OVERDUE',
          });
        }
      } else if (today >= dueDate && schedule.status === 'UPCOMING') {
        await leaseRepository.updateSchedule(schedule.id, {
          status: 'DUE',
        });
      }
    }
  }

  /**
   * --------------------------------------------------------------------------
   * paySchedule(scheduleId, { amount, paidOn }, user)
   * --------------------------------------------------------------------------
   * Function Purpose:
   * Rent Schedule par payment record karta hai.
   * 
   * Flow & Security:
   * 1. Amount validation (> 0).
   * 2. Multi-tenant Scope check: Sirf associated Tenant ya Property Owner/Admin hi payment record kar sakte hain.
   * 3. Partial payment vs Full payment settlement calculate karta hai.
   * 4. Agar total dues cover ho gaye toh status 'PAID', varna 'PARTIALLY_PAID'.
   * 
   * @param {string} scheduleId - RentSchedule ID
   * @param {{ amount: number, paidOn?: string }} paymentData
   * @param {Object} user - Authenticated user context
   */
  async paySchedule(scheduleId, { amount, paidOn }, user) {
    if (!amount || amount <= 0) {
      throw new ApiError(400, 'Payment amount must be greater than 0');
    }

    const schedule = await prisma.rentSchedule.findUnique({
      where: { id: scheduleId },
      include: {
        lease: {
          include: {
            property: true,
          },
        },
      },
    });

    if (!schedule) {
      throw new ApiError(404, 'Rent schedule not found');
    }

    if (user) {
      const scope = await getUserScope(user);
      const isTenant = schedule.lease.tenantId === user.id;
      const isOwnerOrAdmin =
        scope.isSuperAdmin ||
        schedule.lease.property?.ownerId === user.id ||
        schedule.lease.property?.createdById === user.id ||
        scope.orgIds.includes(schedule.lease.property?.organizationId);

      if (!isTenant && !isOwnerOrAdmin) {
        throw new ApiError(
          403,
          'Access denied: You are not authorized to record payments for this rent schedule'
        );
      }
    }

    return leaseRepository.recordSchedulePayment(scheduleId, {
      amount: parseFloat(amount),
      paidOn: paidOn ? new Date(paidOn) : new Date(),
    });
  }

  /**
   * --------------------------------------------------------------------------
   * getExpiringLeases(user)
   * --------------------------------------------------------------------------
   * Fetches leases expiring within the next 30 days (or already expired).
   */
  async getExpiringLeases(user) {
    const scope = await getUserScope(user);
    const now = new Date();
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() + 30); // 30 days ahead

    const where = {
      status: { in: ['ACTIVE', 'EXPIRING', 'EXPIRED'] },
      endDate: { lte: thresholdDate },
    };

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

    const leases = await prisma.lease.findMany({
      where,
      include: {
        property: {
          select: {
            id: true,
            title: true,
            address: true,
            city: true,
            organizationId: true,
            ownerId: true,
            organization: true,
            owner: {
              select: { id: true, name: true, mobile: true, email: true },
            },
          },
        },
        unit: true,
        tenant: {
          select: { id: true, name: true, mobile: true, email: true },
        },
        rentRule: true,
      },
      orderBy: { endDate: 'asc' },
    });

    return leases.map((l) => {
      const end = new Date(l.endDate);
      const diffTime = end.getTime() - now.getTime();
      const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return {
        ...l,
        daysRemaining,
        isExpired: daysRemaining <= 0,
      };
    });
  }

  /**
   * --------------------------------------------------------------------------
   * renewLease(id, { escalationPercentage, newMonthlyRent, durationMonths }, user)
   * --------------------------------------------------------------------------
   * Renews an existing lease with optional rent hike and generates upcoming schedules.
   */
  async renewLease(id, { escalationPercentage, newMonthlyRent, durationMonths = 11 } = {}, user) {
    const lease = await this.getLease(id, user);

    let escalatedRent = Number(lease.monthlyRent);
    if (newMonthlyRent && Number(newMonthlyRent) > 0) {
      escalatedRent = Number(newMonthlyRent);
    } else if (escalationPercentage && Number(escalationPercentage) > 0) {
      escalatedRent = Math.round(Number(lease.monthlyRent) * (1 + Number(escalationPercentage) / 100));
    }

    const currentEnd = new Date(lease.endDate);
    const now = new Date();
    const newStartDate = currentEnd > now ? currentEnd : now;
    const newEndDate = new Date(newStartDate);
    newEndDate.setMonth(newEndDate.getMonth() + Number(durationMonths || 11));

    // Update lease
    await prisma.lease.update({
      where: { id },
      data: {
        monthlyRent: escalatedRent,
        startDate: newStartDate,
        endDate: newEndDate,
        status: 'ACTIVE',
      },
    });

    // Also update Unit rentAmount
    if (lease.unitId) {
      await prisma.unit.update({
        where: { id: lease.unitId },
        data: { rentAmount: escalatedRent },
      });
    }

    // Generate upcoming rent schedules for the renewal term
    const dueDay = lease.rentRule?.dueDay || 5;
    const monthsToGenerate = Math.min(Number(durationMonths || 11), 6);
    for (let i = 0; i < monthsToGenerate; i++) {
      const schedDate = new Date(newStartDate.getFullYear(), newStartDate.getMonth() + i, dueDay, 12, 0, 0);
      const periodName = schedDate.toLocaleString('default', { month: 'long', year: 'numeric' });

      const exists = await prisma.rentSchedule.findFirst({
        where: { leaseId: id, period: periodName },
      });

      if (!exists) {
        await prisma.rentSchedule.create({
          data: {
            leaseId: id,
            period: periodName,
            dueDate: schedDate,
            amount: escalatedRent,
            paidAmount: 0,
            penaltyAmount: 0,
            status: 'UPCOMING',
          },
        });
      }
    }

    return this.getLease(id, user);
  }

  /**
   * --------------------------------------------------------------------------
   * terminateLease(id, { reason }, user)
   * --------------------------------------------------------------------------
   */
  async terminateLease(id, { reason } = {}, user) {
    const lease = await this.getLease(id, user);

    const terminated = await prisma.lease.update({
      where: { id },
      data: {
        status: 'TERMINATED',
        terms: reason ? `${lease.terms || ''}\n[Terminated]: ${reason}` : lease.terms,
      },
    });

    if (lease.unitId) {
      await prisma.unit.update({
        where: { id: lease.unitId },
        data: { status: 'VACANT' },
      });
    }

    return terminated;
  }
}

export const leaseService = new LeaseService();
