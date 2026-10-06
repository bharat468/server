import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/config/database.config.js';
import jwt from 'jsonwebtoken';
import { env } from '../src/config/env.config.js';

const app = createApp();

describe('SuperAdmin Dynamic Plans, Expiry & RBAC Integration Tests', () => {
  let adminToken;
  let adminUser;
  let testOrg;
  let starterPlan;

  beforeAll(async () => {
    // Clean up test roles
    await prisma.superAdminRole.deleteMany({
      where: { slug: { startsWith: 'operations-controller-' } },
    });

    // 1. Create or find SuperAdmin user
    adminUser = await prisma.user.upsert({
      where: { mobile: '9876543210' },
      update: { isSuperAdmin: true, adminRole: 'SUPER_ADMIN', status: 'ACTIVE' },
      create: {
        mobile: '9876543210',
        name: 'Bharat Admin',
        isSuperAdmin: true,
        adminRole: 'SUPER_ADMIN',
        status: 'ACTIVE',
      },
    });

    // Generate JWT for SuperAdmin
    adminToken = jwt.sign(
      { id: adminUser.id, mobile: adminUser.mobile, isSuperAdmin: true, role: 'Super Administrator' },
      env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    // 2. Ensure test organization exists
    testOrg = await prisma.organization.findFirst({
      where: { ownerId: adminUser.id },
    });

    if (!testOrg) {
      testOrg = await prisma.organization.create({
        data: {
          name: 'Test Enterprise Portfolio',
          slug: 'test-enterprise-portfolio',
          ownerId: adminUser.id,
        },
      });
    }

    // 3. Find Starter Plan
    starterPlan = await prisma.plan.findFirst();
  });

  afterAll(async () => {
    await prisma.superAdminRole.deleteMany({
      where: { slug: { startsWith: 'operations-controller-' } },
    });
    await prisma.plan.deleteMany({
      where: { slug: { startsWith: 'custom-plan-' } },
    });
    await prisma.$disconnect();
  });

  test('SuperAdmin can list platform SuperAdmin roles (GET /api/v1/admin/roles)', async () => {
    const res = await request(app)
      .get('/api/v1/admin/roles')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  test('SuperAdmin can create a new dynamic Platform Role (POST /api/v1/admin/roles)', async () => {
    const dynamicSlug = `operations-controller-${Date.now()}`;
    const res = await request(app)
      .post('/api/v1/admin/roles')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Operations Controller',
        slug: dynamicSlug,
        description: 'Audits properties and checks compliance',
        permissions: ['PLATFORM_VIEW_VITALS', 'PLATFORM_MANAGE_USERS'],
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('Operations Controller');
    expect(res.body.data.permissions).toContain('PLATFORM_VIEW_VITALS');
  });

  test('SuperAdmin can dynamically create a SaaS Pricing Plan (POST /api/v1/plans)', async () => {
    const testSlug = `custom-plan-${Date.now()}`;
    const res = await request(app)
      .post('/api/v1/plans')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Platinum Tier Test',
        slug: testSlug,
        description: 'Elite real estate management tier',
        priceMonthly: 4999,
        priceYearly: 49990,
        maxProperties: 50,
        maxTenants: 150,
        maxStaff: 10,
        features: ['Priority 24/7 Hotline', 'Custom Domain', 'Unlimited Portals'],
        isActive: true,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('Platinum Tier Test');
    expect(res.body.data.maxProperties).toBe(50);
  });

  test('SuperAdmin can update an Organization subscription with custom expiry date (PUT /api/v1/admin/organizations/:id/subscription)', async () => {
    const nextYear = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

    const res = await request(app)
      .put(`/api/v1/admin/organizations/${testOrg.id}/subscription`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        planId: starterPlan.id,
        expiresAt: nextYear,
        status: 'ACTIVE',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.planId).toBe(starterPlan.id);
    expect(res.body.data.status).toBe('ACTIVE');
  });

  test('SuperAdmin can list all organizations with their active plan and expiry (GET /api/v1/admin/organizations)', async () => {
    const res = await request(app)
      .get('/api/v1/admin/organizations')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    const org = res.body.data.find((o) => o.id === testOrg.id);
    expect(org).toBeDefined();
    expect(org.subscription).toBeDefined();
  });
});
