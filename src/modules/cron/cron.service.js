import { prisma } from '../../config/database.config.js';
import { logger } from '../../common/logger/logger.js';

/**
 * ============================================================================
 * CRON SERVICE — AUTOMATED LIFECYCLE ENGINE (BRD Sec 13, 14 & 26)
 * ============================================================================
 * Yeh service pure system ka automatic background engine hai.
 * Iska main kaam:
 * 1. Rent Schedules ko track karna (UPCOMING -> DUE -> OVERDUE status change karna).
 * 2. Grace Period ke baad late fee / penalty calculate karna (per-day, fixed, ya percentage).
 * 3. Max penalty cap ensure karna taaki extra penalty charge na ho.
 * 4. Expired SaaS subscriptions ko auto-expire karna.
 */
export class CronService {
  /**
   * --------------------------------------------------------------------------
   * 1. evaluateRentSchedules(asOfDate)
   * --------------------------------------------------------------------------
   * Function Purpose:
   * Sabhi active leases ke unpaid rent schedules ko scan karta hai.
   * 
   * Flow & Logic:
   * 1. Today >= DueDate && < GraceEnd -> Schedule status 'DUE' banta hai.
   * 2. Today > GracePeriodEnd -> Schedule status 'OVERDUE' banta hai aur late fee calculate hoti hai.
   * 3. Penalty Formulas:
   *    - 'PER_DAY': daysLate * penaltyAmount
   *    - 'FIXED': penaltyAmount (one-time fee)
   *    - 'PERCENTAGE': (penaltyAmount / 100) * schedule.amount
   * 4. Ceiling Check: Agar calculated penalty > maxPenaltyCap hai, toh maxPenaltyCap lagti hai.
   * 
   * @param {Date} [asOfDate=new Date()] - Deterministic testing & simulation ke liye date parameter
   * @returns {Promise<Object>} Promoted schedules count aur total penalty assessed
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

          // Safety Cap: Penalty max cap ceiling se zyada nahi ho sakti
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
   * --------------------------------------------------------------------------
   * 2. evaluateSubscriptionExpirations(asOfDate)
   * --------------------------------------------------------------------------
   * Function Purpose:
   * Sabhi Organizations ke SaaS Plans & Subscriptions scan karta hai.
   * Agar kisi organization ka plan expire ho gaya hai, toh status 'EXPIRED' karta hai.
   * 
   * @param {Date} [asOfDate=new Date()]
   * @returns {Promise<Object>} Expired subscriptions summary
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
   * --------------------------------------------------------------------------
   * 3. runDailyLifecycleCron(asOfDate)
   * --------------------------------------------------------------------------
   * Function Purpose:
   * Master execution function jo dono jobs (Rent schedules + Subscription expirations)
   * ko parallel me execute karta hai aur detailed execution telemetry log karta hai.
   * 
   * @param {Date} [asOfDate=new Date()]
   * @returns {Promise<Object>} Complete cron execution summary report
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
