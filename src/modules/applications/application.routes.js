import { Router } from 'express';
import { applicationController } from './application.controller.js';
import { authenticate } from '../../common/middleware/auth.middleware.js';
import { validateRequest } from '../../common/validators/request.validator.js';
import {
  submitApplicationSchema,
  approveApplicationSchema,
} from '../../common/validators/application.validator.js';

const router = Router();

router.use(authenticate);

// Tenant endpoints
router.post('/', validateRequest(submitApplicationSchema), applicationController.submit);
router.get('/my', applicationController.listMy);

// Owner endpoints
router.get('/', applicationController.listOwner);
router.post('/:id/approve', validateRequest(approveApplicationSchema), applicationController.approve);
router.post('/:id/reject', applicationController.reject);

export default router;
