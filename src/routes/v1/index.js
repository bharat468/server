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
import unitRouter from '../../modules/units/unit.routes.js';
import listingRouter from '../../modules/listings/listing.routes.js';
import applicationRouter from '../../modules/applications/application.routes.js';
import leaseRouter from '../../modules/leases/lease.routes.js';
import maintenanceRouter from '../../modules/maintenance/maintenance.routes.js';

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

// Multi-Unit Management Routes (/api/v1/units)
router.use('/units', unitRouter);

// Rental Marketplace & Listings Routes (/api/v1/listings)
router.use('/listings', listingRouter);

// Rental Applications & Lease Onboarding (/api/v1/applications)
router.use('/applications', applicationRouter);

// Leases, Rent Rules & Penalty Schedules (/api/v1/leases)
router.use('/leases', leaseRouter);

// Maintenance Requests & Complaints (/api/v1/maintenance)
router.use('/maintenance', maintenanceRouter);

// Tenants Management Routes (/api/v1/tenants)
router.use('/tenants', tenantRouter);

// Payments & Billing Routes (/api/v1/payments)
router.use('/payments', paymentRouter);

// SuperAdmin & Platform User Hub (/api/v1/admin)
router.use('/admin', adminRouter);

// Subscription & Pricing Plans (/api/v1/plans)
router.use('/plans', planRouter);

export default router;
