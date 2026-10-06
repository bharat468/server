import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app.js';
import { prisma } from '../src/config/database.config.js';
import { env } from '../src/config/env.config.js';

const app = createApp();

describe('Frontend-Backend Sync: Properties, Tenants, Payments Integration Tests', () => {
  let user;
  let token;
  let testPropertyId;
  let testTenantId;
  let testPaymentId;

  beforeAll(async () => {
    user = await prisma.user.upsert({
      where: { mobile: '9999988888' },
      update: {},
      create: {
        mobile: '9999988888',
        name: 'Sync Test User',
        email: 'synctest@rentmate.local',
        status: 'ACTIVE',
      },
    });

    token = jwt.sign(
      { id: user.id, mobile: user.mobile, status: user.status },
      env.JWT_SECRET,
      { expiresIn: '1d' }
    );
  });

  afterAll(async () => {
    // Cleanup created test records
    if (testPaymentId) {
      await prisma.payment.deleteMany({ where: { id: testPaymentId } });
    }
    if (testTenantId) {
      await prisma.tenant.deleteMany({ where: { id: testTenantId } });
    }
    if (testPropertyId) {
      await prisma.property.deleteMany({ where: { id: testPropertyId } });
    }
    await prisma.$disconnect();
  });

  describe('Properties API (/api/v1/properties)', () => {
    it('should list all properties', async () => {
      const res = await request(app)
        .get('/api/v1/properties')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('should create a new property', async () => {
      const res = await request(app)
        .post('/api/v1/properties')
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: 'Ocean View Penthouse',
          address: '42 Marine Drive',
          city: 'Mumbai',
          rent: 75000,
          bedrooms: 3,
          status: 'VACANT',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe('Ocean View Penthouse');
      expect(res.body.data.rent).toBe(75000);
      testPropertyId = res.body.data.id;
    });

    it('should get property by id', async () => {
      const res = await request(app)
        .get(`/api/v1/properties/${testPropertyId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(testPropertyId);
    });
  });

  describe('Tenants API (/api/v1/tenants)', () => {
    it('should create a tenant and associate with property', async () => {
      const res = await request(app)
        .post('/api/v1/tenants')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Arjun Verma',
          email: 'arjun.verma@example.com',
          phone: '9876543999',
          propertyId: testPropertyId,
          leaseStart: '2026-03-01',
          leaseEnd: '2027-02-28',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Arjun Verma');
      expect(res.body.data.propertyId).toBe(testPropertyId);
      testTenantId = res.body.data.id;

      // Verify property is updated to OCCUPIED
      const propRes = await request(app)
        .get(`/api/v1/properties/${testPropertyId}`)
        .set('Authorization', `Bearer ${token}`);
      expect(propRes.body.data.status).toBe('OCCUPIED');
    });

    it('should list tenants', async () => {
      const res = await request(app)
        .get('/api/v1/tenants')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.some((t) => t.id === testTenantId)).toBe(true);
    });
  });

  describe('Payments API (/api/v1/payments)', () => {
    it('should create a payment record', async () => {
      const res = await request(app)
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${token}`)
        .send({
          tenantId: testTenantId,
          propertyId: testPropertyId,
          amount: 75000,
          month: '2026-10',
          status: 'PENDING',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.amount).toBe(75000);
      expect(res.body.data.status).toBe('PENDING');
      testPaymentId = res.body.data.id;
    });

    it('should mark payment as PAID', async () => {
      const res = await request(app)
        .put(`/api/v1/payments/${testPaymentId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          status: 'PAID',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('PAID');
      expect(res.body.data.paidOn).not.toBeNull();
    });

    it('should list all payments', async () => {
      const res = await request(app)
        .get('/api/v1/payments')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.some((p) => p.id === testPaymentId)).toBe(true);
    });
  });
});
