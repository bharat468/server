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

  // Deterministic Penalty Calculation Engine (BRD Section 13 & 14, TRD Section 21 & 22)
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

  async paySchedule(scheduleId, { amount, paidOn }, user) {
    if (!amount || amount <= 0) {
      throw new ApiError(400, 'Payment amount must be greater than 0');
    }

    return leaseRepository.recordSchedulePayment(scheduleId, {
      amount: parseFloat(amount),
      paidOn: paidOn ? new Date(paidOn) : new Date(),
    });
  }
}

export const leaseService = new LeaseService();
