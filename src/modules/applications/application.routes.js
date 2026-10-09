import { Router } from 'express';
import { applicationController } from './application.controller.js';
import { authenticate } from '../../common/middleware/auth.middleware.js';

const router = Router();

router.use(authenticate);

// Tenant endpoints
router.post('/', applicationController.submit);
router.get('/my', applicationController.listMy);

// Owner endpoints
router.get('/', applicationController.listOwner);
router.post('/:id/approve', applicationController.approve);
router.post('/:id/reject', applicationController.reject);

export default router;
