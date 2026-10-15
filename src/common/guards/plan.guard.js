import { ApiError } from '../errors/apiError.js';
import { prisma } from '../../config/database.config.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/**
 * Plan Quota & Subscription Expiry Middleware Guard
 * -------------------------------------------------------------------------
 * [Hinglish / Hindi-English Explanation]:
 * Yeh middleware guard multi-tenant SaaS business rules enforce karta hai:
 * 1. SuperAdmin Bypass: SuperAdmin ya platform admin ko saare quotas bypass hote hain.
 * 2. Organization Discovery: User kis organization me add kar raha hai, usko resolve karta hai.
 * 3. Subscription Status & Expiration: Check karta hai ki plan SUSPENDED ya EXPIRED toh nahi hai,
 *    aur end date Date.now() se pehle toh nahi nikal chuki.
 * 4. Quota Limits: Agar quotaType 'properties' hai toh `maxProperties` check karta hai;
 *    agar 'staff' hai toh `maxStaff` check karta hai. Quota exceed hone par clear 403 Forbidden deta hai.
 * 
 * [English Explanation]:
 * Enforces dynamic SaaS plan limits, operational quotas, and subscription expiration.
 * - Resolves target tenant organization via route parameters, body or membership table.
 * - Verifies current timestamp against subscription end date / expiration threshold.
 * - Queries live resource consumption (properties, team staff) against plan allowance.
 * 
 * @param {'properties' | 'staff'} quotaType - The resource type being provisioned
 * @returns {import('express').RequestHandler} Express middleware function
 */
export const checkPlanQuota = (quotaType) =>
  asyncHandler(async (req, _res, next) => {
    const user = req.user;
    if (!user) {
      throw new ApiError(401, 'Authentication required');
    }

    // Platform SuperAdmin bypasses operational quotas for system administration
    if (user.isSuperAdmin || Boolean(user.adminRole)) {
      return next();
    }

    // Determine target organization ID
    let orgId =
      req.params.organizationId ||
      req.body.organizationId ||
      req.ownedOrgId;

    if (!orgId) {
      // Find first organization the user owns or belongs to
      const memberOrg = await prisma.organizationMember.findFirst({
        where: { userId: user.id },
        select: { organizationId: true },
      });
      orgId = memberOrg?.organizationId;
    }

    if (!orgId) {
      // If user has no organization yet, allow proceeding
      return next();
    }

    // Fetch active subscription with plan details
    const subscription = await prisma.subscription.findFirst({
      where: { organizationId: orgId },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!subscription) {
      // No explicit subscription found -> allow default starter
      return next();
    }

    // 1. Expiration & Status Check
    if (subscription.status === 'SUSPENDED') {
      throw new ApiError(
        403,
        'Subscription Suspended: Your organization account has been suspended by administration.'
      );
    }

    if (subscription.status === 'EXPIRED') {
      throw new ApiError(
        403,
        'Subscription Expired: Your organization plan has expired. Please renew your subscription to continue managing properties.'
      );
    }

    const expiryDate = subscription.expiresAt || subscription.endDate;
    if (expiryDate && new Date(expiryDate).getTime() < Date.now()) {
      const expiryFormatted = new Date(expiryDate).toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
      throw new ApiError(
        403,
        `Subscription Expired: Your organization plan expired on ${expiryFormatted}. Please contact platform administration to renew your subscription.`
      );
    }

    // 2. Resource Quota Checks
    const plan = subscription.plan;
    if (!plan) {
      return next();
    }

    if (quotaType === 'properties') {
      const propertyCount = await prisma.property.count({
        where: { organizationId: orgId },
      });

      if (propertyCount >= plan.maxProperties) {
        throw new ApiError(
          403,
          `Plan Quota Exceeded: Your plan (${plan.name}) allows a maximum of ${plan.maxProperties} properties. You currently manage ${propertyCount}. Upgrade your subscription tier to add more properties.`
        );
      }
    }

    if (quotaType === 'staff') {
      const staffCount = await prisma.organizationMember.count({
        where: { organizationId: orgId },
      });

      if (staffCount >= plan.maxStaff) {
        throw new ApiError(
          403,
          `Plan Quota Exceeded: Your plan (${plan.name}) allows a maximum of ${plan.maxStaff} staff accounts. You currently have ${staffCount}. Upgrade your subscription tier to onboard more team members.`
        );
      }
    }

    return next();
  });
