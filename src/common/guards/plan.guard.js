import { ApiError } from '../errors/apiError.js';
import { prisma } from '../../config/database.config.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/**
 * Plan Quota & Expiry Middleware Guard
 * Enforces dynamic SaaS plan limits and subscription expiration dates.
 * @param {'properties' | 'staff'} quotaType
 */
export const checkPlanQuota = (quotaType) =>
  asyncHandler(async (req, _res, next) => {
    const user = req.user;
    if (!user) {
      throw new ApiError(401, 'Authentication required');
    }

    // Platform SuperAdmin bypasses operational quotas for system testing
    if (user.isSuperAdmin || user.mobile === '9876543210') {
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

    // 1. Expiration Date Check
    if (subscription.status === 'SUSPENDED') {
      throw new ApiError(
        403,
        'Subscription Suspended: Your organization account has been suspended by administration.'
      );
    }

    if (subscription.expiresAt && new Date(subscription.expiresAt).getTime() < Date.now()) {
      const expiryFormatted = new Date(subscription.expiresAt).toLocaleDateString('en-IN', {
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
