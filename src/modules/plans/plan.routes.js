import { Router } from 'express';
import { planController } from './plan.controller.js';
import { authenticate } from '../../common/middleware/auth.middleware.js';
import { requireAdmin } from '../../common/guards/admin.guard.js';

const router = Router();

// Public can view available plans for marketing website & onboarding
router.get('/', planController.list);
router.get('/:id', planController.get);

// Only Admin/Owner can manage plans
router.post('/', authenticate, requireAdmin, planController.create);
router.put('/:id', authenticate, requireAdmin, planController.update);
router.delete('/:id', authenticate, requireAdmin, planController.delete);

export default router;
