import { Router } from 'express';
import { propertyController } from './property.controller.js';
import { authenticate } from '../../common/middleware/auth.middleware.js';
import { checkPlanQuota } from '../../common/guards/plan.guard.js';

const router = Router();

// Endpoints can be accessed by authenticated users
router.use(authenticate);

router.get('/', propertyController.list);
router.post('/', checkPlanQuota('properties'), propertyController.create);
router.get('/:id', propertyController.get);
router.put('/:id', propertyController.update);
router.delete('/:id', propertyController.delete);

export default router;
