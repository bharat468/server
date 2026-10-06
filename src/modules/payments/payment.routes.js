import { Router } from 'express';
import { paymentController } from './payment.controller.js';
import { authenticate } from '../../common/middleware/auth.middleware.js';

const router = Router();

// Endpoints can be accessed by authenticated users
router.use(authenticate);

router.get('/', paymentController.list);
router.post('/', paymentController.create);
router.get('/:id', paymentController.get);
router.put('/:id', paymentController.update);
router.delete('/:id', paymentController.delete);

export default router;
