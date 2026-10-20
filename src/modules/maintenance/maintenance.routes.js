import { Router } from 'express';
import { maintenanceController } from './maintenance.controller.js';
import { authenticate } from '../../common/middleware/auth.middleware.js';
import { validateRequest } from '../../common/validators/request.validator.js';
import {
  createMaintenanceSchema,
  updateMaintenanceStatusSchema,
  assignMaintenanceSchema,
} from '../../common/validators/maintenance.validator.js';

const router = Router();

router.use(authenticate);

router.get('/', maintenanceController.list);
router.get('/my', maintenanceController.listMy);
router.post('/', validateRequest(createMaintenanceSchema), maintenanceController.create);
router.patch('/:id/assign', validateRequest(assignMaintenanceSchema), maintenanceController.assign);
router.patch('/:id/status', validateRequest(updateMaintenanceStatusSchema), maintenanceController.updateStatus);

export default router;
