import { Router } from 'express';
import { tenantController } from './tenant.controller.js';
import { authenticate } from '../../common/middleware/auth.middleware.js';

const router = Router();

// Endpoints can be accessed by authenticated users
router.use(authenticate);

router.get('/', tenantController.list);
router.post('/', tenantController.create);
router.get('/:id', tenantController.get);
router.put('/:id', tenantController.update);
router.delete('/:id', tenantController.delete);

export default router;
