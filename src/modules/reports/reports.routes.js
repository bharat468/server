import { Router } from 'express';
import { reportsController } from './reports.controller.js';
import { authenticate } from '../../common/middleware/auth.middleware.js';

const router = Router();

// Reports require authentication
router.use(authenticate);

// 1. Monthly Rent Collection Report
router.get('/monthly-collections', reportsController.getMonthlyCollections);

// 2. Pending Defaulters List
router.get('/defaulters', reportsController.getDefaulters);

// 3. Property-wise Profit & Loss / Expense Report
router.get('/property-pnl', reportsController.getPropertyProfitAndLoss);

export default router;
