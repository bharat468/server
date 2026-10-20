import { Router } from 'express';
import { tenantController } from './tenant.controller.js';
import { authenticate } from '../../common/middleware/auth.middleware.js';
import { validateRequest } from '../../common/validators/request.validator.js';
import { createTenantSchema, updateTenantSchema } from '../../common/validators/tenant.validator.js';

const router = Router();

// Endpoints can be accessed by authenticated users
router.use(authenticate);

router.get('/', tenantController.list);
router.post('/', validateRequest(createTenantSchema), tenantController.create);
router.get('/:id', tenantController.get);
router.put('/:id', validateRequest(updateTenantSchema), tenantController.update);
router.delete('/:id', tenantController.delete);

export default router;
