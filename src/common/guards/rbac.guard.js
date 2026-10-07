import { rbacRepository } from '../../modules/rbac/rbac.repository.js';
import { prisma } from '../../config/database.config.js';
import { ApiError } from '../errors/apiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const requirePermission = (permissionKey) => {
  return asyncHandler(async (req, _res, next) => {
    const user = req.user;
    if (!user) {
      throw new ApiError(401, 'Authentication required');
    }

    // 1. Resolve active organizationId from header, params, query, or body
    let organizationId =
      req.headers['x-organization-id'] ||
      req.params.organizationId ||
      req.query.organizationId ||
      req.body.organizationId;

    // Fallback: If not explicitly supplied in header, check user's organizations
    if (!organizationId) {
      const defaultOrg = await prisma.organization.findFirst({
        where: {
          OR: [
            { ownerId: user.id },
            { members: { some: { userId: user.id } } },
          ],
        },
      });
      if (defaultOrg) {
        organizationId = defaultOrg.id;
      }
    }

    // 2. SuperAdmin Bypass
    if (user.isSuperAdmin || user.adminRole === 'SUPER_ADMIN') {
      req.organizationId = organizationId || null;
      req.isOwner = true;
      req.isSuperAdmin = true;
      req.propertyScope = []; // All properties allowed
      return next();
    }

    if (!organizationId) {
      throw new ApiError(
        400,
        'Organization context required. Please select an active organization or provide x-organization-id.'
      );
    }

    // Check if organization exists
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
    });

    if (!organization) {
      throw new ApiError(404, 'Organization not found');
    }

    // 3. Direct Owner Bypass (The person who created/owns the company has all permissions)
    if (organization.ownerId === user.id) {
      req.organizationId = organizationId;
      req.isOwner = true;
      req.propertyScope = []; // All properties allowed
      return next();
    }

    // 2. Dynamic RBAC Check
    const userRbac = await rbacRepository.getUserPermissionsWithScope(
      user.id,
      organizationId
    );

    if (!userRbac.permissions.includes(permissionKey)) {
      throw new ApiError(
        403,
        `Forbidden: You lack the required permission '${permissionKey}' in this organization.`
      );
    }

    // 3. Property-level Scope Guard
    const requestedPropertyId =
      req.params.propertyId || req.body.propertyId || req.query.propertyId;

    if (
      requestedPropertyId &&
      !userRbac.hasGlobalAccess &&
      userRbac.propertyScope.length > 0
    ) {
      if (!userRbac.propertyScope.includes(requestedPropertyId)) {
        throw new ApiError(
          403,
          'Forbidden: You are not authorized to perform actions on this specific property.'
        );
      }
    }

    req.organizationId = organizationId;
    req.isOwner = false;
    req.propertyScope = userRbac.propertyScope;
    req.userPermissions = userRbac.permissions;

    next();
  });
};
