import { Router } from 'express';
import { unitController } from './unit.controller.js';
import { authenticate } from '../../common/middleware/auth.middleware.js';

const router = Router();

router.use(authenticate);

router.get('/', unitController.list);
router.post('/', unitController.create);
router.get('/:id', unitController.get);
router.patch('/:id', unitController.update);
router.delete('/:id', unitController.delete);

export default router;
