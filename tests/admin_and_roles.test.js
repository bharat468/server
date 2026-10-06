import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app.js';
import { prisma } from '../src/config/database.config.js';
import { env } from '../src/config/env.config.js';

const app = createApp();

describe('Admin, Dynamic Roles & Plans Integration Tests', () => {
  let adminUser;
  let adminToken;
  let nonAdminUser;
  let nonAdminToken;
  let testRoleId;
  let testPlanId;
  let createdUserId;

  beforeAll(async () => {
    // Admin user (designated mobile 9876543210)
    adminUser = await prisma.user.upsert({
      where: { mobile: '9876543210' },
      update: {},
      create: {
        mobile: '9876543210',
        name: 'Super Admin Bharat',
        email: 'bharat@rentmate.local',
        status: 'ACTIVE',
      },
    });

    adminToken = jwt.sign(
      { id: adminUser.id, mobile: adminUser.mobile, status: adminUser.status },
      env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    // Non-admin regular user
    nonAdminUser = await prisma.user.upsert({
      where: { mobile: '9000011111' },
      update: {},
      create: {
        mobile: '9000011111',
        name: 'Regular Tenant User',
        email: 'regular@test.local',
        status: 'ACTIVE',
      },
    });

    nonAdminToken = jwt.sign(
      { id: nonAdminUser.id, mobile: nonAdminUser.mobile, status: nonAdminUser.status },
      env.JWT_SECRET,
      { expiresIn: '1d' }
    );
  });

  afterAll(async () => {
    if (createdUserId) {
      await prisma.userRole.deleteMany({ where: { userId: createdUserId } });
      await prisma.organizationMember.deleteMany({ where: { userId: createdUserId } });
      await prisma.user.deleteMany({ where: { id: createdUserId } });
    }
    if (testRoleId) {
      await prisma.rolePermission.deleteMany({ where: { roleId: testRoleId } });
      await prisma.userRole.deleteMany({ where: { roleId: testRoleId } });
      await prisma.role.deleteMany({ where: { id: testRoleId } });
    }
    if (testPlanId) {
      await prisma.plan.deleteMany({ where: { id: testPlanId } });
    }
    await prisma.$disconnect();
  });

  describe('Security & Admin Access Guard', () => {
    it('should deny non-admin users from accessing /api/v1/admin/users', async () => {
      const res = await request(app)
        .get('/api/v1/admin/users')
        .set('Authorization', `Bearer ${nonAdminToken}`);

      expect(res.status).toBe(403);
    });

    it('should allow SuperAdmin mobile to access /api/v1/admin/overview', async () => {
      const res = await request(app)
        .get('/api/v1/admin/overview')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('totalUsers');
    });
  });

  describe('Dynamic Roles Management (/api/v1/roles)', () => {
    it('should list all 25 granular permissions', async () => {
      const res = await request(app)
        .get('/api/v1/roles/permissions')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(25);
    });

    it('should create a custom dynamic role with selected permissions', async () => {
      const res = await request(app)
        .post('/api/v1/roles')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Site Supervisor',
          description: 'Supervises on-site building maintenance and leases',
          permissionKeys: ['property.read', 'maintenance.create', 'maintenance.read'],
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Site Supervisor');
      expect(res.body.data.permissions.length).toBe(3);
      testRoleId = res.body.data.id;
    });

    it('should update the custom role permissions', async () => {
      const res = await request(app)
        .put(`/api/v1/roles/${testRoleId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Chief Site Supervisor',
          permissionKeys: ['property.read', 'maintenance.create', 'maintenance.read', 'tenant.read'],
        });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Chief Site Supervisor');
      expect(res.body.data.permissions.length).toBe(4);
    });
  });

  describe('Admin Platform User Management (/api/v1/admin/users)', () => {
    it('should create a new staff user with assigned custom role', async () => {
      const res = await request(app)
        .post('/api/v1/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          mobile: '9777788888',
          name: 'Vikas Supervisor',
          email: 'vikas@rentmate.local',
          roleId: testRoleId,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.mobile).toBe('9777788888');
      expect(res.body.data.name).toBe('Vikas Supervisor');
      createdUserId = res.body.data.id;
    });

    it('should update user status to INACTIVE / SUSPENDED', async () => {
      const res = await request(app)
        .put(`/api/v1/admin/users/${createdUserId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'SUSPENDED' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('SUSPENDED');
    });
  });

  describe('SaaS Plans Management (/api/v1/plans)', () => {
    it('should list all plans', async () => {
      const res = await request(app)
        .get('/api/v1/plans')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(3);
    });

    it('should create a new subscription plan', async () => {
      const res = await request(app)
        .post('/api/v1/plans')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Platinum Tier',
          description: 'Unlimited properties and VIP concierge',
          priceMonthly: 9999,
          priceYearly: 99990,
          maxProperties: 500,
          maxTenants: 2000,
          maxStaff: 50,
          features: ['All Features', 'VIP Concierge', 'Dedicated Database'],
        });

      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe('Platinum Tier');
      testPlanId = res.body.data.id;
    });
  });
});
