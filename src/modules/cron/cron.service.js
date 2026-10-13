import { prisma } from '../../config/database.config.js';
import { logger } from '../../common/logger/logger.js';

export class CronService {
  /**
   * Evaluates all unpaid RentSchedules across all active leases.
   * Auto-promotes UPCOMING -> DUE -> OVERDUE and calculates escalating late penalties.
   * Supports `asOfDate` for deterministic cron runs & simulation testing.
   */
  async evaluateRentSchedules(asOfDate = new Date()) {
    const today = new Date(asOfDate);
    const leases = await prisma.lease.findMany({
      where: {
        status: { in: ['ACTIVE', 'EXPIRING'] },
      },
      include: {
        rentRule: true,
        schedules: {
          where: {
            status: { in: ['UPCOMING', 'DUE', 'PARTIALLY_PAID', 'OVERDUE'] },
          },
        },
      },
    });

    let dueCount = 0;
    let overdueCount = 0;
    let totalPenaltyAssessed = 0;

    for (const lease of leases) {
      const rule = lease.rentRule;
      const graceDays = rule?.graceDays ?? 3;
      const penaltyType = rule?.penaltyType ?? 'PER_DAY';
      const penaltyAmount = Number(rule?.penaltyAmount ?? 100);
      const maxCap = Number(rule?.maxPenaltyCap ?? 2000);

      for (const schedule of lease.schedules) {
        if (schedule.status === 'PAID') continue;

        const dueDate = new Date(schedule.dueDate);
        const gracePeriodEnd = new Date(dueDate);
        gracePeriodEnd.setDate(gracePeriodEnd.getDate() + graceDays);

        if (today > gracePeriodEnd) {
          // Beyond grace period -> OVERDUE with escalating late fee
          const diffTime = today.getTime() - dueDate.getTime();
          const daysLate = Math.max(1, Math.floor(diffTime / (1000 * 60 * 60 * 24)));

          let calculatedPenalty = 0;
          if (penaltyType === 'PER_DAY') {
            calculatedPenalty = daysLate * penaltyAmount;
          } else if (penaltyType === 'FIXED') {
            calculatedPenalty = penaltyAmount;
          } else if (penaltyType === 'PERCENTAGE') {
            calculatedPenalty = (penaltyAmount / 100) * Number(schedule.amount);
          }

          if (maxCap > 0 && calculatedPenalty > maxCap) {
            calculatedPenalty = maxCap;
          }

          if (schedule.penaltyAmount !== calculatedPenalty || schedule.status !== 'OVERDUE') {
            await prisma.rentSchedule.update({
              where: { id: schedule.id },
              data: {
                penaltyAmount: calculatedPenalty,
                status: 'OVERDUE',
              },
            });
            overdueCount++;
            totalPenaltyAssessed += calculatedPenalty;
          }
        } else if (today >= dueDate && schedule.status === 'UPCOMING') {
          // Due date reached, but still within grace days -> DUE (no penalty yet)
          await prisma.rentSchedule.update({
            where: { id: schedule.id },
            data: {
              status: 'DUE',
            },
          });
          dueCount++;
        }
      }
    }

    return {
      evaluatedAt: today.toISOString(),
      schedulesPromotedToDue: dueCount,
      schedulesPromotedToOverdue: overdueCount,
      totalPenaltyAssessed,
    };
  }

  /**
   * Scans Organization Subscriptions and expires any accounts past their endDate / expiresAt.
   * Auto-promotes ACTIVE / TRIAL -> EXPIRED.
   */
  async evaluateSubscriptionExpirations(asOfDate = new Date()) {
    const today = new Date(asOfDate);

    // Find subscriptions that have passed endDate or expiresAt and are not yet marked EXPIRED
    const expiredSubscriptions = await prisma.subscription.findMany({
      where: {
        status: { in: ['ACTIVE', 'TRIAL'] },
        OR: [
          {
            endDate: { lt: today },
          },
          {
            expiresAt: { lt: today },
          },
        ],
      },
    });

    let expiredCount = 0;
    for (const sub of expiredSubscriptions) {
      await prisma.subscription.update({
        where: { id: sub.id },
        data: {
          status: 'EXPIRED',
        },
      });
      expiredCount++;
    }

    return {
      evaluatedAt: today.toISOString(),
      subscriptionsExpired: expiredCount,
      expiredSubscriptionIds: expiredSubscriptions.map((s) => s.id),
    };
  }

  /**
   * Master Daily Lifecycle Cron Job:
   * Runs overdue penalty evaluation and subscription expiration checks.
   */
  async runDailyLifecycleCron(asOfDate = new Date()) {
    const startTime = Date.now();
    logger.info({ asOfDate }, '[CronService] Starting daily lifecycle evaluation job...');

    const [rentResults, subResults] = await Promise.all([
      this.evaluateRentSchedules(asOfDate),
      this.evaluateSubscriptionExpirations(asOfDate),
    ]);

    const durationMs = Date.now() - startTime;
    const summary = {
      jobName: 'DAILY_LIFECYCLE_CRON',
      executionTimeMs: durationMs,
      timestamp: new Date().toISOString(),
      rentEvaluation: rentResults,
      subscriptionEvaluation: subResults,
    };

    logger.info(summary, '[CronService] Daily lifecycle evaluation job completed successfully');
    return summary;
  }
}

export const cronService = new CronService();
