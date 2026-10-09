import { Router } from 'express';
import { leaseController } from './lease.controller.js';
import { authenticate } from '../../common/middleware/auth.middleware.js';

const router = Router();

router.use(authenticate);

// Tenant endpoint to view their own active rentals
router.get('/my-rentals', leaseController.listMyRentals);

// Owner list of leases
router.get('/', leaseController.listOwner);
router.get('/:id', leaseController.get);
router.post('/schedules/:scheduleId/pay', leaseController.paySchedule);

export default router;
