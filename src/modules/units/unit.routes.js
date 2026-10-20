import { Router } from 'express';
import { unitController } from './unit.controller.js';
import { authenticate } from '../../common/middleware/auth.middleware.js';
import { validateRequest } from '../../common/validators/request.validator.js';
import {
  createUnitSchema,
  updateUnitSchema,
  recordMeterReadingSchema,
} from '../../common/validators/unit.validator.js';

const router = Router();

router.use(authenticate);

router.get('/', unitController.list);
router.post('/', validateRequest(createUnitSchema), unitController.create);
router.get('/:id', unitController.get);
router.patch('/:id', validateRequest(updateUnitSchema), unitController.update);
router.delete('/:id', unitController.delete);

// Utility Sub-Meter Reading Routes
router.post(
  '/:id/meter-readings',
  validateRequest(recordMeterReadingSchema),
  unitController.recordMeterReading
);
router.get('/:id/meter-readings', unitController.getMeterReadings);

export default router;
