import { ApiError } from '../errors/apiError.js';
import { prisma } from '../../config/database.config.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const requireAdmin = asyncHandler(async (req, _res, next) => {
  const user = req.user;
  if (!user) {
    throw new ApiError(401, 'Authentication required');
  }

  // 1. Check if user is a designated SuperAdmin flag or mobile
  const superAdminMobiles = ['8003953815', '9876543210', process.env.ADMIN_MOBILE].filter(Boolean);
  if (user.isSuperAdmin || superAdminMobiles.includes(user.mobile)) {
    req.isAdmin = true;
    req.isSuperAdmin = true;
    return next();
  }

  // 2. Check if user owns any organization
  const ownedOrg = await prisma.organization.findFirst({
    where: { ownerId: user.id },
  });

  if (ownedOrg) {
    req.isAdmin = true;
    req.ownedOrgId = ownedOrg.id;
    return next();
  }

  // 3. Check if user has an OWNER role assignment
  const ownerRole = await prisma.userRole.findFirst({
    where: {
      userId: user.id,
      role: { slug: 'owner' },
    },
  });

  if (ownerRole) {
    req.isAdmin = true;
    return next();
  }

  throw new ApiError(403, 'Access denied: Admin or Owner privileges required');
});
