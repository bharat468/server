import { Router } from 'express';
import { organizationController } from './organization.controller.js';
import { authenticate } from '../../common/middleware/auth.middleware.js';
import { requirePermission } from '../../common/guards/rbac.guard.js';
import { checkPlanQuota } from '../../common/guards/plan.guard.js';

const router = Router();

// All organization endpoints require an authenticated user
router.use(authenticate);

// Create and List Organizations
router.post('/', organizationController.create);
router.get('/', organizationController.list);
router.get('/:id', organizationController.getDetails);

// Member and Role Management (Protected by Organization Scope Guard)
router.get(
  '/:organizationId/members',
  organizationController.listMembers
);

router.post(
  '/:organizationId/members',
  requirePermission('role.assign'),
  checkPlanQuota('staff'),
  organizationController.addMember
);

router.put(
  '/:organizationId/members/:userId',
  requirePermission('role.assign'),
  organizationController.updateMember
);

router.delete(
  '/:organizationId/members/:userId',
  requirePermission('role.assign'),
  organizationController.removeMember
);

router.post(
  '/:organizationId/roles',
  requirePermission('role.create'),
  organizationController.createRole
);

export default router;
