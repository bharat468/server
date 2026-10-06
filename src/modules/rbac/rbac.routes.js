import { Router } from 'express';
import { rbacRepository } from './rbac.repository.js';
import { authenticate } from '../../common/middleware/auth.middleware.js';
import { ApiResponse } from '../../common/utils/apiResponse.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';
import { ApiError } from '../../common/errors/apiError.js';

const router = Router();

router.use(authenticate);

// List All 25 Granular Permissions
router.get(
  '/permissions',
  asyncHandler(async (_req, res) => {
    const permissions = await rbacRepository.listPermissions();
    res.status(200).json(
      new ApiResponse(200, permissions, 'Permissions fetched successfully')
    );
  })
);

// List System & Custom Roles
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const orgId = req.query.organizationId || null;
    const roles = await rbacRepository.listRoles(orgId);
    res.status(200).json(
      new ApiResponse(200, roles, 'Roles fetched successfully')
    );
  })
);

// Create Dynamic Custom Role
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { name, slug, description, permissionKeys, organizationId } = req.body;
    if (!name) {
      throw new ApiError(400, 'Role name is required');
    }
    const computedSlug = slug || name.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const role = await rbacRepository.createRole({
      organizationId: organizationId || null,
      name,
      slug: computedSlug,
      description,
      permissionKeys: permissionKeys || [],
    });
    res.status(201).json(
      new ApiResponse(201, role, 'Role created successfully')
    );
  })
);

// Update Role
router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const { name, description, permissionKeys } = req.body;
    const updated = await rbacRepository.updateRole(req.params.id, {
      name,
      description,
      permissionKeys,
    });
    res.status(200).json(
      new ApiResponse(200, updated, 'Role updated successfully')
    );
  })
);

// Delete Custom Role
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await rbacRepository.deleteRole(req.params.id);
    res.status(200).json(
      new ApiResponse(200, null, 'Role deleted successfully')
    );
  })
);

export default router;
