import { Router } from 'express';
import { ApiResponse } from '../../common/utils/apiResponse.js';
import authRouter from '../../modules/auth/auth.routes.js';
import organizationRouter from '../../modules/organizations/organization.routes.js';
import rbacRouter from '../../modules/rbac/rbac.routes.js';
import propertyRouter from '../../modules/properties/property.routes.js';
import tenantRouter from '../../modules/tenants/tenant.routes.js';
import paymentRouter from '../../modules/payments/payment.routes.js';
import adminRouter from '../../modules/admin/admin.routes.js';
import planRouter from '../../modules/plans/plan.routes.js';

const router = Router();

// Health Check Endpoint
router.get('/health', (_request, response) => {
  response.status(200).json(
    new ApiResponse(
      200,
      {
        status: 'ok',
        service: 'RENTMATE API',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
      },
      'RENTMATE API is running smoothly'
    )
  );
});

// Authentication Routes (/api/v1/auth)
router.use('/auth', authRouter);

// Organization Management Routes (/api/v1/organizations)
router.use('/organizations', organizationRouter);

// Dynamic RBAC Roles & Permissions Routes (/api/v1/roles)
router.use('/roles', rbacRouter);

// Properties Management Routes (/api/v1/properties)
router.use('/properties', propertyRouter);

// Tenants Management Routes (/api/v1/tenants)
router.use('/tenants', tenantRouter);

// Payments & Billing Routes (/api/v1/payments)
router.use('/payments', paymentRouter);

// SuperAdmin & Platform User Hub (/api/v1/admin)
router.use('/admin', adminRouter);

// Subscription & Pricing Plans (/api/v1/plans)
router.use('/plans', planRouter);

export default router;
