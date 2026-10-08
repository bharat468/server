import { Router } from 'express';
import { adminController } from './admin.controller.js';
import { authenticate } from '../../common/middleware/auth.middleware.js';
import { requireAdmin, requirePlatformPermission } from '../../common/guards/admin.guard.js';

const router = Router();

// Gated strictly for authenticated Admin/Owner
router.use(authenticate, requireAdmin);

router.get(
  '/overview',
  requirePlatformPermission('PLATFORM_VIEW_VITALS'),
  adminController.getOverview
);

router.get(
  '/users',
  requirePlatformPermission('PLATFORM_MANAGE_USERS'),
  adminController.listUsers
);
router.post(
  '/users',
  requirePlatformPermission('PLATFORM_MANAGE_USERS'),
  adminController.createUser
);
router.put(
  '/users/:id',
  requirePlatformPermission('PLATFORM_MANAGE_USERS'),
  adminController.updateUser
);
router.delete(
  '/users/:id',
  requirePlatformPermission('PLATFORM_MANAGE_USERS'),
  adminController.deleteUser
);
router.put(
  '/users/:id/status',
  requirePlatformPermission('PLATFORM_MANAGE_USERS'),
  adminController.updateStatus
);
router.put(
  '/users/:id/role',
  requirePlatformPermission('PLATFORM_MANAGE_USERS'),
  adminController.updateRole
);
router.put(
  '/users/:id/admin-role',
  requirePlatformPermission('PLATFORM_MANAGE_ADMIN_ROLES'),
  adminController.assignAdminRole
);

// SuperAdmin RBAC Role Governance
router.get(
  '/roles',
  requirePlatformPermission('PLATFORM_MANAGE_ADMIN_ROLES'),
  adminController.listSuperAdminRoles
);
router.post(
  '/roles',
  requirePlatformPermission('PLATFORM_MANAGE_ADMIN_ROLES'),
  adminController.createSuperAdminRole
);
router.put(
  '/roles/:id',
  requirePlatformPermission('PLATFORM_MANAGE_ADMIN_ROLES'),
  adminController.updateSuperAdminRole
);
router.delete(
  '/roles/:id',
  requirePlatformPermission('PLATFORM_MANAGE_ADMIN_ROLES'),
  adminController.deleteSuperAdminRole
);

// Client Organizations & Subscription / Expiry Controls
router.get(
  '/organizations',
  requirePlatformPermission('PLATFORM_MANAGE_ORGANIZATIONS'),
  adminController.listOrganizations
);
router.put(
  '/organizations/:id/subscription',
  requirePlatformPermission('PLATFORM_MANAGE_ORGANIZATIONS'),
  adminController.updateOrganizationSubscription
);

// Dynamic System Platform Settings
router.get(
  '/settings',
  requirePlatformPermission('PLATFORM_MANAGE_BILLING'),
  adminController.listSettings
);
router.put(
  '/settings/:key',
  requirePlatformPermission('PLATFORM_MANAGE_BILLING'),
  adminController.updateSetting
);

export default router;
