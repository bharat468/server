import { Router } from 'express';
import { paymentController } from './payment.controller.js';
import { authenticate } from '../../common/middleware/auth.middleware.js';
import { validateRequest } from '../../common/validators/request.validator.js';
import { createPaymentSchema, updatePaymentSchema } from '../../common/validators/payment.validator.js';

const router = Router();

// Endpoints can be accessed by authenticated users
router.use(authenticate);

router.get('/', paymentController.list);
router.post('/', validateRequest(createPaymentSchema), paymentController.create);
router.get('/:id', paymentController.get);
router.put('/:id', validateRequest(updatePaymentSchema), paymentController.update);
router.delete('/:id', paymentController.delete);

export default router;
