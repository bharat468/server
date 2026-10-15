import { ApiError } from '../errors/apiError.js';
import { prisma } from '../../config/database.config.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const requireAdmin = asyncHandler(async (req, _res, next) => {
  const user = req.user;
  if (!user) {
    throw new ApiError(401, 'Authentication required');
  }

  if (user.status !== 'ACTIVE') {
    throw new ApiError(403, `Access denied: Your account is ${user.status.toLowerCase()}.`);
  }

  // Strictly check if user is a designated SuperAdmin or has an assigned platform admin role
  if (user.isSuperAdmin || Boolean(user.adminRole)) {
    req.isAdmin = true;
    req.isSuperAdmin = Boolean(user.isSuperAdmin || user.adminRole === 'SUPER_ADMIN');
    return next();
  }

  // Client Landlords, Property Managers, and Tenants are strictly barred from platform admin endpoints
  throw new ApiError(
    403,
    'Access denied: Platform SuperAdministrator privileges required. Landlords and tenants cannot access the platform admin portal.'
  );
});

export const requirePlatformPermission = (permissionKey) => {
  return asyncHandler(async (req, _res, next) => {
    const user = req.user;
    if (!user) {
      throw new ApiError(401, 'Authentication required');
    }

    if (user.status !== 'ACTIVE') {
      throw new ApiError(403, `Access denied: Your account is ${user.status.toLowerCase()}.`);
    }

    // Master SuperAdmin has universal platform access
    if (user.isSuperAdmin || user.adminRole === 'SUPER_ADMIN') {
      return next();
    }

    if (!user.adminRole) {
      throw new ApiError(403, 'Platform administrator privileges required');
    }

    const saRole = await prisma.superAdminRole.findFirst({
      where: {
        OR: [
          { slug: user.adminRole },
          { slug: user.adminRole.toLowerCase() },
          { id: user.adminRole },
        ],
      },
    });

    if (!saRole || !saRole.permissions?.includes(permissionKey)) {
      throw new ApiError(
        403,
        `Forbidden: Your platform administrative role lacks permission '${permissionKey}'`
      );
    }

    next();
  });
};
