import { Router } from 'express';
import { maintenanceController } from './maintenance.controller.js';
import { authenticate } from '../../common/middleware/auth.middleware.js';

const router = Router();

router.use(authenticate);

router.get('/', maintenanceController.list);
router.get('/my', maintenanceController.listMy);
router.post('/', maintenanceController.create);
router.patch('/:id/assign', maintenanceController.assign);
router.patch('/:id/status', maintenanceController.updateStatus);

export default router;
