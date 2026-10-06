import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/config/database.config.js';
import jwt from 'jsonwebtoken';
import { env } from '../src/config/env.config.js';

const app = createApp();

describe('Multi-Tenant Landlord Data Isolation Integration Tests', () => {
  const landlordAMobile = '9111111111';
  const landlordBMobile = '9222222222';

  let userA, userB;
  let tokenA, tokenB;
  let orgA, orgB;
  let propertyA, propertyB;
  let tenantA;

  beforeAll(async () => {
    // Clean up
    await prisma.user.deleteMany({
      where: { mobile: { in: [landlordAMobile, landlordBMobile] } },
    });

    // 1. Create Landlord A & Organization A
    userA = await prisma.user.create({
      data: {
        mobile: landlordAMobile,
        name: 'Landlord Alpha',
        status: 'ACTIVE',
      },
    });

    orgA = await prisma.organization.create({
      data: {
        name: 'Alpha Estates',
        slug: 'alpha-estates-' + Date.now(),
        ownerId: userA.id,
        members: { create: { userId: userA.id, role: 'OWNER' } },
      },
    });

    tokenA = jwt.sign(
      { id: userA.id, mobile: userA.mobile, role: 'Owner' },
      env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    // 2. Create Landlord B & Organization B
    userB = await prisma.user.create({
      data: {
        mobile: landlordBMobile,
        name: 'Landlord Beta',
        status: 'ACTIVE',
      },
    });

    orgB = await prisma.organization.create({
      data: {
        name: 'Beta Living',
        slug: 'beta-living-' + Date.now(),
        ownerId: userB.id,
        members: { create: { userId: userB.id, role: 'OWNER' } },
      },
    });

    tokenB = jwt.sign(
      { id: userB.id, mobile: userB.mobile, role: 'Owner' },
      env.JWT_SECRET,
      { expiresIn: '1h' }
    );
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { mobile: { in: [landlordAMobile, landlordBMobile] } },
    });
    await prisma.$disconnect();
  });

  test('Landlord A creates Property A and Landlord B creates Property B', async () => {
    const resA = await request(app)
      .post('/api/v1/properties')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        title: 'Alpha Tower 101',
        address: '101 Alpha Road',
        city: 'Mumbai',
        rent: 25000,
        bedrooms: 2,
        organizationId: orgA.id,
      });

    expect(resA.status).toBe(201);
    propertyA = resA.body.data;
    expect(propertyA.organizationId).toBe(orgA.id);

    const resB = await request(app)
      .post('/api/v1/properties')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({
        title: 'Beta Villa 202',
        address: '202 Beta Boulevard',
        city: 'Pune',
        rent: 45000,
        bedrooms: 3,
        organizationId: orgB.id,
      });

    expect(resB.status).toBe(201);
    propertyB = resB.body.data;
    expect(propertyB.organizationId).toBe(orgB.id);
  });

  test('Landlord A only sees Property A, and NEVER sees Property B', async () => {
    const res = await request(app)
      .get('/api/v1/properties')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    const properties = res.body.data;
    const titles = properties.map((p) => p.title);

    expect(titles).toContain('Alpha Tower 101');
    expect(titles).not.toContain('Beta Villa 202');
  });

  test('Landlord B only sees Property B, and NEVER sees Property A', async () => {
    const res = await request(app)
      .get('/api/v1/properties')
      .set('Authorization', `Bearer ${tokenB}`);

    expect(res.status).toBe(200);
    const properties = res.body.data;
    const titles = properties.map((p) => p.title);

    expect(titles).toContain('Beta Villa 202');
    expect(titles).not.toContain('Alpha Tower 101');
  });

  test('Landlord B cannot access Property A directly via GET /properties/:id (403 Forbidden)', async () => {
    const res = await request(app)
      .get(`/api/v1/properties/${propertyA.id}`)
      .set('Authorization', `Bearer ${tokenB}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  test('Landlord B cannot delete Property A (403 Forbidden)', async () => {
    const res = await request(app)
      .delete(`/api/v1/properties/${propertyA.id}`)
      .set('Authorization', `Bearer ${tokenB}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  test('Landlord A onboards Tenant A on Property A', async () => {
    const res = await request(app)
      .post('/api/v1/tenants')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        name: 'Amit Sharma',
        email: 'amit@example.com',
        phone: '9811122233',
        propertyId: propertyA.id,
        leaseStart: '2026-01-01',
        leaseEnd: '2026-12-31',
      });

    expect(res.status).toBe(201);
    tenantA = res.body.data;
  });

  test('Landlord B cannot see Landlord A tenants (Zero Leakage on GET /tenants)', async () => {
    const res = await request(app)
      .get('/api/v1/tenants')
      .set('Authorization', `Bearer ${tokenB}`);

    expect(res.status).toBe(200);
    const tenantIds = res.body.data.map((t) => t.id);
    expect(tenantIds).not.toContain(tenantA.id);
  });

  test('Landlord B cannot view Landlord A organization details (403 Forbidden)', async () => {
    const res = await request(app)
      .get(`/api/v1/organizations/${orgA.id}`)
      .set('Authorization', `Bearer ${tokenB}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });
});
