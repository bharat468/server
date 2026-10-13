import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app.js';
import { prisma } from '../src/config/database.config.js';
import { env } from '../src/config/env.config.js';

const app = createApp();

describe('Comprehensive Validation, Security & Business Rules Test Suite', () => {
  let superAdminUser;
  let superAdminToken;
  let landlordA;
  let landlordAToken;
  let landlordB;
  let landlordBToken;
  let tenantUser;
  let tenantToken;
  let orgA;
  let orgB;
  let propA;
  let propB;

  beforeAll(async () => {
    // 1. Setup Platform SuperAdmin
    superAdminUser = await prisma.user.upsert({
      where: { mobile: '9900011101' },
      update: { isSuperAdmin: true, adminRole: 'SUPER_ADMIN' },
      create: {
        mobile: '9900011101',
        name: 'SuperAdmin ValTester',
        email: 'superadmin_val@rentmate.local',
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

    // 2. Setup Landlord A
    landlordA = await prisma.user.upsert({
      where: { mobile: '9900011102' },
      update: { isSuperAdmin: false, adminRole: null },
      create: {
        mobile: '9900011102',
        name: 'Landlord Alpha',
        email: 'landlord_alpha@rentmate.local',
        status: 'ACTIVE',
      },
    });
    landlordAToken = jwt.sign(
      { id: landlordA.id, mobile: landlordA.mobile, status: landlordA.status },
      env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    // 3. Setup Landlord B
    landlordB = await prisma.user.upsert({
      where: { mobile: '9900011103' },
      update: { isSuperAdmin: false, adminRole: null },
      create: {
        mobile: '9900011103',
        name: 'Landlord Beta',
        email: 'landlord_beta@rentmate.local',
        status: 'ACTIVE',
      },
    });
    landlordBToken = jwt.sign(
      { id: landlordB.id, mobile: landlordB.mobile, status: landlordB.status },
      env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    // 4. Setup Tenant
    tenantUser = await prisma.user.upsert({
      where: { mobile: '9900011104' },
      update: { isSuperAdmin: false, adminRole: null },
      create: {
        mobile: '9900011104',
        name: 'Tenant Charlie',
        email: 'tenant_charlie@rentmate.local',
        status: 'ACTIVE',
      },
    });
    tenantToken = jwt.sign(
      { id: tenantUser.id, mobile: tenantUser.mobile, status: tenantUser.status },
      env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    // 5. Setup Organizations A & B
    orgA = await prisma.organization.create({
      data: {
        name: 'Alpha Heights Real Estate',
        slug: `alpha-heights-${Date.now()}`,
        ownerId: landlordA.id,
      },
    });

    orgB = await prisma.organization.create({
      data: {
        name: 'Beta Towers Real Estate',
        slug: `beta-towers-${Date.now()}`,
        ownerId: landlordB.id,
      },
    });

    // 6. Setup Properties for A and B
    propA = await prisma.property.create({
      data: {
        title: 'Alpha Royal Residency',
        address: '10 Alpha Lane',
        city: 'Mumbai',
        rent: 35000,
        bedrooms: 2,
        status: 'VACANT',
        organizationId: orgA.id,
        ownerId: landlordA.id,
      },
    });

    propB = await prisma.property.create({
      data: {
        title: 'Beta Palm Grove',
        address: '20 Beta Avenue',
        city: 'Bengaluru',
        rent: 45000,
        bedrooms: 3,
        status: 'VACANT',
        organizationId: orgB.id,
        ownerId: landlordB.id,
      },
    });
  });

  afterAll(async () => {
    // Cleanup
    if (propA) {
      await prisma.maintenanceRequest.deleteMany({ where: { propertyId: propA.id } });
      await prisma.unit.deleteMany({ where: { propertyId: propA.id } });
      await prisma.property.delete({ where: { id: propA.id } }).catch(() => {});
    }
    if (propB) {
      await prisma.maintenanceRequest.deleteMany({ where: { propertyId: propB.id } });
      await prisma.unit.deleteMany({ where: { propertyId: propB.id } });
      await prisma.property.delete({ where: { id: propB.id } }).catch(() => {});
    }
    if (orgA) {
      await prisma.organization.delete({ where: { id: orgA.id } }).catch(() => {});
    }
    if (orgB) {
      await prisma.organization.delete({ where: { id: orgB.id } }).catch(() => {});
    }
    await prisma.$disconnect();
  });

  // =========================================================================
  // 1. AUTHENTICATION & INPUT SANITIZATION
  // =========================================================================
  describe('1. Auth & Mobile Validation Suite', () => {
    it('1.1: Rejects mobile numbers with fewer than 10 digits', async () => {
      const res = await request(app)
        .post('/api/v1/auth/lookup')
        .send({ mobile: '98765' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('10-digit mobile number');
    });

    it('1.2: Rejects mobile numbers with alphabets or symbols', async () => {
      const res = await request(app)
        .post('/api/v1/auth/send-otp')
        .send({ mobile: '98765ABCD4' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('10-digit');
    });

    it('1.3: Rejects completely empty mobile parameter', async () => {
      const res = await request(app)
        .post('/api/v1/auth/send-otp')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('1.4: Rejects protected routes when no Bearer token is provided', async () => {
      const res = await request(app).get('/api/v1/properties');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('1.5: Rejects forged or malformed JWT token', async () => {
      const res = await request(app)
        .get('/api/v1/properties')
        .set('Authorization', 'Bearer forged.token.signature');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  // =========================================================================
  // 2. PROPERTY MODULE VALIDATION & ACCESS ISOLATION
  // =========================================================================
  describe('2. Property Validation & Cross-Tenant Isolation', () => {
    it('2.1: Rejects property creation with zero or negative rent', async () => {
      const res = await request(app)
        .post('/api/v1/properties')
        .set('Authorization', `Bearer ${landlordAToken}`)
        .send({
          title: 'Negative Rent Mansion',
          address: '1 Zero St',
          city: 'Mumbai',
          rent: -5000,
          bedrooms: 2,
          organizationId: orgA.id,
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('greater than 0');
    });

    it('2.2: Rejects property creation with missing title or address', async () => {
      const res = await request(app)
        .post('/api/v1/properties')
        .set('Authorization', `Bearer ${landlordAToken}`)
        .send({
          title: '',
          address: '',
          city: 'Mumbai',
          rent: 20000,
          bedrooms: 2,
          organizationId: orgA.id,
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('title is required');
    });

    it('2.3: Rejects property creation with negative bedrooms', async () => {
      const res = await request(app)
        .post('/api/v1/properties')
        .set('Authorization', `Bearer ${landlordAToken}`)
        .send({
          title: 'Weird Bedrooms Flat',
          address: '42 Subzero Way',
          city: 'Delhi',
          rent: 20000,
          bedrooms: -4,
          organizationId: orgA.id,
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('cannot be negative');
    });

    it('2.4: Cross-Tenant Isolation: Landlord A cannot delete Landlord B\'s property', async () => {
      const res = await request(app)
        .delete(`/api/v1/properties/${propB.id}`)
        .set('Authorization', `Bearer ${landlordAToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Access denied');
    });

    it('2.5: Cross-Tenant Isolation: Landlord A\'s listing returns 0 of Landlord B\'s properties', async () => {
      const res = await request(app)
        .get('/api/v1/properties')
        .set('Authorization', `Bearer ${landlordAToken}`);

      expect(res.status).toBe(200);
      const returnedIds = res.body.data.map((p) => p.id);
      expect(returnedIds).toContain(propA.id);
      expect(returnedIds).not.toContain(propB.id);
    });
  });

  // =========================================================================
  // 3. UNIT MANAGEMENT VALIDATION
  // =========================================================================
  describe('3. Unit Management Validation', () => {
    it('3.1: Rejects unit creation with empty unit number', async () => {
      const res = await request(app)
        .post('/api/v1/units')
        .set('Authorization', `Bearer ${landlordAToken}`)
        .send({
          propertyId: propA.id,
          unitNumber: '',
          rentAmount: 30000,
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Unit number is required');
    });

    it('3.2: Rejects unit creation with zero or negative rent', async () => {
      const res = await request(app)
        .post('/api/v1/units')
        .set('Authorization', `Bearer ${landlordAToken}`)
        .send({
          propertyId: propA.id,
          unitNumber: 'Flat 101',
          rentAmount: 0,
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('greater than 0');
    });

    it('3.3: Rejects unit creation with negative deposit amount', async () => {
      const res = await request(app)
        .post('/api/v1/units')
        .set('Authorization', `Bearer ${landlordAToken}`)
        .send({
          propertyId: propA.id,
          unitNumber: 'Flat 102',
          rentAmount: 25000,
          depositAmount: -10000,
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('cannot be negative');
    });

    it('3.4: Rejects adding unit to another landlord\'s property', async () => {
      const res = await request(app)
        .post('/api/v1/units')
        .set('Authorization', `Bearer ${landlordAToken}`)
        .send({
          propertyId: propB.id, // Owned by Landlord B
          unitNumber: 'Infiltrator Unit',
          rentAmount: 25000,
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Access denied');
    });
  });

  // =========================================================================
  // 4. MAINTENANCE & COMPLAINTS VALIDATION
  // =========================================================================
  describe('4. Maintenance & Complaints Validation', () => {
    let createdTicket;

    it('4.1: Rejects ticket creation with empty title or description', async () => {
      const res = await request(app)
        .post('/api/v1/maintenance')
        .set('Authorization', `Bearer ${tenantToken}`)
        .send({
          propertyId: propA.id,
          title: '',
          description: '',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('title is required');
    });

    it('4.2: Successfully creates ticket with valid title & description', async () => {
      const res = await request(app)
        .post('/api/v1/maintenance')
        .set('Authorization', `Bearer ${tenantToken}`)
        .send({
          propertyId: propA.id,
          title: 'Water tap leaking in washroom',
          description: 'Constant drip from the hot water fixture since yesterday morning.',
          category: 'PLUMBING',
          priority: 'MEDIUM',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('OPEN');
      createdTicket = res.body.data;
    });

    it('4.3: Rejects status update with negative repair cost', async () => {
      const res = await request(app)
        .patch(`/api/v1/maintenance/${createdTicket.id}/status`)
        .set('Authorization', `Bearer ${landlordAToken}`)
        .send({
          status: 'RESOLVED',
          cost: -450,
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('cannot be negative');
    });

    it('4.4: Landlord B cannot resolve or tamper with Landlord A\'s maintenance ticket', async () => {
      const res = await request(app)
        .patch(`/api/v1/maintenance/${createdTicket.id}/status`)
        .set('Authorization', `Bearer ${landlordBToken}`)
        .send({
          status: 'CLOSED',
          cost: 1000,
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Access denied');
    });
  });

  // =========================================================================
  // 5. PLATFORM SECURITY & RBAC ACCESS BOUNDARIES
  // =========================================================================
  describe('5. Platform Security & SuperAdmin Boundaries', () => {
    it('5.1: Normal Tenant cannot access SuperAdmin Overview (Strict 403 Forbidden)', async () => {
      const res = await request(app)
        .get('/api/v1/admin/overview')
        .set('Authorization', `Bearer ${tenantToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('5.2: Normal Landlord cannot access SuperAdmin Overview (Strict 403 Forbidden)', async () => {
      const res = await request(app)
        .get('/api/v1/admin/overview')
        .set('Authorization', `Bearer ${landlordAToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('5.3: Normal Landlord cannot trigger administrative cron jobs', async () => {
      const res = await request(app)
        .post('/api/v1/admin/cron/run')
        .set('Authorization', `Bearer ${landlordAToken}`)
        .send({ asOfDate: '2026-10-15' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('5.4: SuperAdmin successfully accesses SuperAdmin Overview & Vitals', async () => {
      const res = await request(app)
        .get('/api/v1/admin/overview')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.totalUsers).toBeDefined();
    });
  });
});
