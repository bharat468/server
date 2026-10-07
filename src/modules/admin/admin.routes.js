import { Router } from 'express';
import { adminController } from './admin.controller.js';
import { authenticate } from '../../common/middleware/auth.middleware.js';
import { requireAdmin } from '../../common/guards/admin.guard.js';

const router = Router();

// Gated strictly for authenticated Admin/Owner
router.use(authenticate, requireAdmin);

router.get('/overview', adminController.getOverview);
router.get('/users', adminController.listUsers);
router.post('/users', adminController.createUser);
router.put('/users/:id', adminController.updateUser);
router.delete('/users/:id', adminController.deleteUser);
router.put('/users/:id/status', adminController.updateStatus);
router.put('/users/:id/role', adminController.updateRole);
router.put('/users/:id/admin-role', adminController.assignAdminRole);

// SuperAdmin RBAC Role Governance
router.get('/roles', adminController.listSuperAdminRoles);
router.post('/roles', adminController.createSuperAdminRole);
router.put('/roles/:id', adminController.updateSuperAdminRole);
router.delete('/roles/:id', adminController.deleteSuperAdminRole);

// Client Organizations & Subscription / Expiry Controls
router.get('/organizations', adminController.listOrganizations);
router.put('/organizations/:id/subscription', adminController.updateOrganizationSubscription);

// Dynamic System Platform Settings
router.get('/settings', adminController.listSettings);
router.put('/settings/:key', adminController.updateSetting);

export default router;
