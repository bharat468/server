import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app.js';
import { prisma } from '../src/config/database.config.js';
import { env } from '../src/config/env.config.js';
import { cronService } from '../src/modules/cron/cron.service.js';

const app = createApp();

describe('Real-Life Edge Cases & Automation Suite (Plan Expiry, Rent Due & Cron Jobs)', () => {
  let superAdminUser;
  let superAdminToken;
  let landlordUser;
  let landlordToken;
  let tenantUser;
  let tenantToken;
  let testOrg;
  let starterPlan;
  let proPlan;

  beforeAll(async () => {
    // 1. Setup Platform SuperAdmin
    superAdminUser = await prisma.user.upsert({
      where: { mobile: '9999900001' },
      update: { isSuperAdmin: true, adminRole: 'SUPER_ADMIN' },
      create: {
        mobile: '9999900001',
        name: 'SuperAdmin Edge Case Tester',
        email: 'superadmin_edge@rentmate.local',
        isSuperAdmin: true,
        adminRole: 'SUPER_ADMIN',
        status: 'ACTIVE',
      },
    });
    superAdminToken = jwt.sign(
      {
        id: superAdminUser.id,
        mobile: superAdminUser.mobile,
        status: superAdminUser.status,
        isSuperAdmin: true,
        adminRole: 'SUPER_ADMIN',
        role: 'Platform SuperAdministrator',
      },
      env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    // 2. Setup Landlord User
    landlordUser = await prisma.user.upsert({
      where: { mobile: '9999900002' },
      update: { isSuperAdmin: false, adminRole: null },
      create: {
        mobile: '9999900002',
        name: 'Landlord Edge Case Tester',
        email: 'landlord_edge@rentmate.local',
        status: 'ACTIVE',
      },
    });
    landlordToken = jwt.sign(
      { id: landlordUser.id, mobile: landlordUser.mobile, status: landlordUser.status },
      env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    // 3. Setup Tenant User
    tenantUser = await prisma.user.upsert({
      where: { mobile: '9999900003' },
      update: { isSuperAdmin: false, adminRole: null },
      create: {
        mobile: '9999900003',
        name: 'Tenant Edge Case Tester',
        email: 'tenant_edge@rentmate.local',
        status: 'ACTIVE',
      },
    });
    tenantToken = jwt.sign(
      { id: tenantUser.id, mobile: tenantUser.mobile, status: tenantUser.status },
      env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    // 4. Create Plans: Starter (max 1 property, max 2 tenants) & Pro (max 10)
    starterPlan = await prisma.plan.upsert({
      where: { slug: 'test-starter-plan' },
      update: { maxProperties: 1, maxTenants: 2 },
      create: {
        name: 'Test Starter Plan',
        slug: 'test-starter-plan',
        priceMonthly: 499,
        maxProperties: 1,
        maxTenants: 2,
        maxStaff: 1,
        isActive: true,
      },
    });

    proPlan = await prisma.plan.upsert({
      where: { slug: 'test-pro-plan' },
      update: { maxProperties: 10, maxTenants: 20 },
      create: {
        name: 'Test Pro Plan',
        slug: 'test-pro-plan',
        priceMonthly: 1999,
        maxProperties: 10,
        maxTenants: 20,
        maxStaff: 5,
        isActive: true,
      },
    });

    // 5. Create Test Organization owned by Landlord
    testOrg = await prisma.organization.create({
      data: {
        name: 'Edge Case Realty Org',
        slug: `edge-case-realty-${Date.now()}`,
        ownerId: landlordUser.id,
        subscriptions: {
          create: {
            planId: starterPlan.id,
            status: 'ACTIVE',
            startDate: new Date('2026-01-01'),
            endDate: new Date('2026-12-31'),
          },
        },
      },
    });
  });

  afterAll(async () => {
    // Cleanup created test records
    if (testOrg) {
      await prisma.maintenanceRequest.deleteMany({
        where: { property: { organizationId: testOrg.id } },
      });
      await prisma.rentSchedule.deleteMany({
        where: { lease: { property: { organizationId: testOrg.id } } },
      });
      await prisma.rentRule.deleteMany({
        where: { lease: { property: { organizationId: testOrg.id } } },
      });
      await prisma.lease.deleteMany({
        where: { property: { organizationId: testOrg.id } },
      });
      await prisma.rentalApplication.deleteMany({
        where: { listing: { property: { organizationId: testOrg.id } } },
      });
      await prisma.rentalListing.deleteMany({
        where: { property: { organizationId: testOrg.id } },
      });
      await prisma.unit.deleteMany({
        where: { property: { organizationId: testOrg.id } },
      });
      await prisma.payment.deleteMany({
        where: { property: { organizationId: testOrg.id } },
      });
      await prisma.tenant.deleteMany({
        where: { property: { organizationId: testOrg.id } },
      });
      await prisma.property.deleteMany({
        where: { organizationId: testOrg.id },
      });
      await prisma.subscription.deleteMany({
        where: { organizationId: testOrg.id },
      });
      await prisma.organization.deleteMany({
        where: { id: testOrg.id },
      });
    }

    if (starterPlan) {
      await prisma.plan.delete({ where: { id: starterPlan.id } }).catch(() => {});
    }
    if (proPlan) {
      await prisma.plan.delete({ where: { id: proPlan.id } }).catch(() => {});
    }

    await prisma.$disconnect();
  });

  // =========================================================================
  // SUITE 1: REAL-LIFE SAAS PLAN QUOTA & EXPIRATION EDGE CASES
  // =========================================================================
  describe('SaaS Subscription Plan Expiration & Quota Enforcement', () => {
    let prop1;

    it('Edge Case 1.1: Landlord creates 1st property within starter plan quota (max 1)', async () => {
      const res = await request(app)
        .post('/api/v1/properties')
        .set('Authorization', `Bearer ${landlordToken}`)
        .send({
          title: 'Starter Apartment Unit 1',
          address: '42 MG Road',
          city: 'Mumbai',
          rent: 20000,
          bedrooms: 2,
          organizationId: testOrg.id,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      prop1 = res.body.data;
    });

    it('Edge Case 1.2: Landlord attempts 2nd property exceeding starter plan limit (403 Quota Reached)', async () => {
      const res = await request(app)
        .post('/api/v1/properties')
        .set('Authorization', `Bearer ${landlordToken}`)
        .send({
          title: 'Over Quota Apartment Unit 2',
          address: '43 MG Road',
          city: 'Mumbai',
          rent: 22000,
          bedrooms: 2,
          organizationId: testOrg.id,
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Plan Quota Exceeded');
    });

    it('Edge Case 1.3: SuperAdmin bypasses landlord quota when provisioning properties', async () => {
      const res = await request(app)
        .post('/api/v1/properties')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          title: 'SuperAdmin Managed Property',
          address: '44 MG Road',
          city: 'Mumbai',
          rent: 25000,
          bedrooms: 3,
          organizationId: testOrg.id,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      // Clean up the extra property
      await prisma.property.delete({ where: { id: res.body.data.id } });
    });

    it('Edge Case 1.4: Expired Subscription blocks creating new properties (403 Expired)', async () => {
      // Artificially expire the organization's subscription
      await prisma.subscription.updateMany({
        where: { organizationId: testOrg.id },
        data: {
          status: 'EXPIRED',
          endDate: new Date('2025-12-31'),
        },
      });

      const res = await request(app)
        .post('/api/v1/properties')
        .set('Authorization', `Bearer ${landlordToken}`)
        .send({
          title: 'Blocked Apartment on Expired Plan',
          address: '45 MG Road',
          city: 'Mumbai',
          rent: 18000,
          bedrooms: 1,
          organizationId: testOrg.id,
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Subscription Expired');

      // Restore subscription to ACTIVE for subsequent tests
      await prisma.subscription.updateMany({
        where: { organizationId: testOrg.id },
        data: {
          status: 'ACTIVE',
          endDate: new Date('2026-12-31'),
        },
      });
    });

    it('Edge Case 1.5: Upgrading organization to Pro Plan allows adding more properties', async () => {
      // Upgrade subscription to Pro Plan
      await prisma.subscription.updateMany({
        where: { organizationId: testOrg.id },
        data: {
          planId: proPlan.id,
          status: 'ACTIVE',
        },
      });

      const res = await request(app)
        .post('/api/v1/properties')
        .set('Authorization', `Bearer ${landlordToken}`)
        .send({
          title: 'Pro Tier Apartment Unit 2',
          address: '46 MG Road',
          city: 'Mumbai',
          rent: 30000,
          bedrooms: 2,
          organizationId: testOrg.id,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });
  });

  // =========================================================================
  // SUITE 2: REAL-LIFE CRON JOB, DUE DATES & LATE PENALTIES
  // =========================================================================
  describe('Automated Cron Job Engine: Due Dates, Grace Periods & Late Fees', () => {
    let leaseProperty;
    let leaseUnit;
    let leaseContract;
    let scheduleId;

    beforeAll(async () => {
      // Setup property, unit, and lease with strict rent rule
      leaseProperty = await prisma.property.create({
        data: {
          title: 'Cron Automation Villa',
          address: 'Plot 77, Cyber City',
          city: 'Gurugram',
          rent: 30000,
          bedrooms: 2,
          status: 'OCCUPIED',
          organizationId: testOrg.id,
          ownerId: landlordUser.id,
        },
      });

      leaseUnit = await prisma.unit.create({
        data: {
          propertyId: leaseProperty.id,
          unitNumber: 'V-101',
          floor: 1,
          type: 'VILLA_3BHK',
          rentAmount: 30000,
          depositAmount: 60000,
          status: 'OCCUPIED',
        },
      });

      // Lease with: Due Day 5, Grace Days 3, Penalty: 100/day, Max Cap: 1000
      leaseContract = await prisma.lease.create({
        data: {
          propertyId: leaseProperty.id,
          unitId: leaseUnit.id,
          tenantId: tenantUser.id,
          monthlyRent: 30000,
          securityDeposit: 60000,
          startDate: new Date('2026-10-01'),
          endDate: new Date('2027-09-30'),
          status: 'ACTIVE',
          rentRule: {
            create: {
              dueDay: 5,
              graceDays: 3, // Grace period ends on 5 + 3 = 8th
              penaltyType: 'PER_DAY',
              penaltyAmount: 100,
              maxPenaltyCap: 1000,
            },
          },
          schedules: {
            create: {
              period: '2026-10',
              dueDate: new Date('2026-10-05T00:00:00Z'),
              amount: 30000,
              paidAmount: 0,
              penaltyAmount: 0,
              status: 'UPCOMING',
            },
          },
        },
        include: { schedules: true },
      });

      scheduleId = leaseContract.schedules[0].id;
    });

    it('Edge Case 2.1: Before Due Date (Oct 2) -> Schedule status remains UPCOMING with 0 penalty', async () => {
      const result = await cronService.evaluateRentSchedules(new Date('2026-10-02T00:00:00Z'));
      const schedule = await prisma.rentSchedule.findUnique({ where: { id: scheduleId } });

      expect(schedule.status).toBe('UPCOMING');
      expect(schedule.penaltyAmount).toBe(0);
    });

    it('Edge Case 2.2: Due Date Arrived within Grace Period (Oct 6) -> Promotes to DUE with 0 penalty', async () => {
      await cronService.evaluateRentSchedules(new Date('2026-10-06T00:00:00Z'));
      const schedule = await prisma.rentSchedule.findUnique({ where: { id: scheduleId } });

      expect(schedule.status).toBe('DUE');
      expect(schedule.penaltyAmount).toBe(0);
    });

    it('Edge Case 2.3: Grace Period Expired (Oct 10, 5 days late) -> Promotes to OVERDUE with 5 * 100 = 500 penalty', async () => {
      await cronService.evaluateRentSchedules(new Date('2026-10-10T00:00:00Z'));
      const schedule = await prisma.rentSchedule.findUnique({ where: { id: scheduleId } });

      expect(schedule.status).toBe('OVERDUE');
      expect(schedule.penaltyAmount).toBe(500); // 5 days late * 100
    });

    it('Edge Case 2.4: Severe Late Payment (Oct 30, 25 days late) -> Caps penalty at maxPenaltyCap (1000)', async () => {
      await cronService.evaluateRentSchedules(new Date('2026-10-30T00:00:00Z'));
      const schedule = await prisma.rentSchedule.findUnique({ where: { id: scheduleId } });

      expect(schedule.status).toBe('OVERDUE');
      expect(schedule.penaltyAmount).toBe(1000); // Capped at 1000 instead of 2500
    });

    it('Edge Case 2.5: Full Payment Settles Schedule -> Future Cron runs preserve PAID status', async () => {
      // Tenant pays the total due (base amount 30000 + 1000 penalty = 31000)
      const payRes = await request(app)
        .post(`/api/v1/leases/schedules/${scheduleId}/pay`)
        .set('Authorization', `Bearer ${tenantToken}`)
        .send({
          amount: 31000,
          paidOn: '2026-10-31',
        });

      expect(payRes.status).toBe(200);

      // Subsequent cron run for November should not alter the settled schedule
      await cronService.evaluateRentSchedules(new Date('2026-11-15T00:00:00Z'));
      const updatedSchedule = await prisma.rentSchedule.findUnique({ where: { id: scheduleId } });
      expect(updatedSchedule.status).toBe('PAID');
    });

    it('Edge Case 2.6: Admin triggers master daily lifecycle cron via API endpoint', async () => {
      const res = await request(app)
        .post('/api/v1/admin/cron/run')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          asOfDate: '2026-10-15',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.jobName).toBe('DAILY_LIFECYCLE_CRON');
      expect(res.body.data.rentEvaluation).toBeDefined();
      expect(res.body.data.subscriptionEvaluation).toBeDefined();
    });
  });

  // =========================================================================
  // SUITE 3: FINANCIAL & OPERATIONAL REPORTS EDGE CASES (BRD SEC 25)
  // =========================================================================
  describe('Financial Reports Edge Cases & Resiliency (BRD Sec 25)', () => {
    it('Edge Case 3.1: Zero collections does not produce divide-by-zero on collection rate', async () => {
      // Query a futuristic month with zero transactions
      const res = await request(app)
        .get('/api/v1/reports/monthly-collections?month=2029-01')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.summary.collectionRate).toBe(0);
      expect(res.body.data.summary.totalExpected).toBe(0);
      expect(res.body.data.items).toEqual([]);
    });

    it('Edge Case 3.2: High operational maintenance expense exceeding rent yields negative margin gracefully', async () => {
      const testPnlProp = await prisma.property.create({
        data: {
          title: 'High Maintenance Testing Asset',
          address: '99 Repair Lane',
          city: 'Pune',
          rent: 10000,
          status: 'OCCUPIED',
          organizationId: testOrg.id,
          ownerId: landlordUser.id,
          payments: {
            create: {
              tenantId: (await prisma.tenant.findFirst()).id,
              amount: 10000,
              month: '2026-10',
              status: 'PAID',
            },
          },
          maintenanceRequests: {
            create: {
              tenantId: tenantUser.id,
              title: 'Major Roof & Electrical Replacement',
              description: 'Complete overhaul of building wiring and roof tiles',
              cost: 50000, // 5x higher than rent income
              status: 'RESOLVED',
            },
          },
        },
      });

      const res = await request(app)
        .get('/api/v1/reports/property-pnl')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      const row = res.body.data.items.find((i) => i.propertyId === testPnlProp.id);
      expect(row).toBeDefined();
      expect(row.grossIncome).toBe(10000);
      expect(row.totalExpenses).toBe(50000);
      expect(row.netProfit).toBe(-40000); // Loss of 40,000
      expect(row.profitMargin).toBeLessThan(0); // Negative profit margin

      // Clean up
      await prisma.maintenanceRequest.deleteMany({ where: { propertyId: testPnlProp.id } });
      await prisma.payment.deleteMany({ where: { propertyId: testPnlProp.id } });
      await prisma.property.delete({ where: { id: testPnlProp.id } });
    });

    it('Edge Case 3.3: One-click CSV export streams correctly formatted text/csv headers', async () => {
      const res = await request(app)
        .get('/api/v1/reports/monthly-collections?format=csv')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.headers['content-disposition']).toContain('attachment');
      expect(res.text).toContain('Receipt No');
      expect(res.text).toContain('Billing Month');
      expect(res.text).toContain('Tenant Name');
    });

    it('Edge Case 3.4: Payment recording rejects negative or non-numeric amount values', async () => {
      const tenant = await prisma.tenant.findFirst();
      const res = await request(app)
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          tenantId: tenant?.id,
          amount: -5000,
          month: '2026-10',
          status: 'PAID',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('greater than 0');
    });
  });
});
