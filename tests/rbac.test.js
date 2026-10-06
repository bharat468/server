import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app.js';
import { prisma } from '../src/config/database.config.js';
import { env } from '../src/config/env.config.js';

const app = createApp();

describe('Phase 4: Dynamic RBAC & Organizations Integration Tests', () => {
  let ownerUser;
  let ownerToken;
  let managerUser;
  let managerToken;
  let organization;

  beforeAll(async () => {
    // 1. Create Owner User
    ownerUser = await prisma.user.upsert({
      where: { mobile: '9111122222' },
      update: {},
      create: {
        mobile: '9111122222',
        name: 'Test Owner',
        email: 'owner@test.local',
        status: 'ACTIVE',
      },
    });

    ownerToken = jwt.sign(
      { id: ownerUser.id, mobile: ownerUser.mobile, status: ownerUser.status },
      env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    // 2. Create Manager User
    managerUser = await prisma.user.upsert({
      where: { mobile: '9333344444' },
      update: {},
      create: {
        mobile: '9333344444',
        name: 'Test Manager',
        email: 'manager@test.local',
        status: 'ACTIVE',
      },
    });

    managerToken = jwt.sign(
      { id: managerUser.id, mobile: managerUser.mobile, status: managerUser.status },
      env.JWT_SECRET,
      { expiresIn: '1d' }
    );
  });

  afterAll(async () => {
    if (organization) {
      await prisma.userRole.deleteMany({ where: { organizationId: organization.id } }).catch(() => {});
      await prisma.organizationMember.deleteMany({ where: { organizationId: organization.id } }).catch(() => {});
      await prisma.role.deleteMany({ where: { organizationId: organization.id } }).catch(() => {});
      await prisma.organization.delete({ where: { id: organization.id } }).catch(() => {});
    }
    await prisma.user.deleteMany({ where: { mobile: { in: ['9111122222', '9333344444'] } } }).catch(() => {});
    await prisma.$disconnect();
  });

  test('successfully creates an organization and assigns owner role', async () => {
    const res = await request(app)
      .post('/api/v1/organizations')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: 'Apex Realty',
        slug: 'apex-realty-' + Date.now(),
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBeDefined();

    organization = res.body.data;
  });

  test('lists all system permissions via GET /api/v1/roles/permissions', async () => {
    const res = await request(app)
      .get('/api/v1/roles/permissions')
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(20);
  });

  test('adds a member with Property Manager role and specific property scope', async () => {
    const propertyIdScope = 'prop-101-alpha';

    const res = await request(app)
      .post(`/api/v1/organizations/${organization.id}/members`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-organization-id', organization.id)
      .send({
        mobile: managerUser.mobile,
        roleSlug: 'property-manager',
        propertyScope: [propertyIdScope],
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.propertyScope).toContain(propertyIdScope);
  });

  test('creates a custom dynamic role with custom permissions in organization', async () => {
    const uniqueSlug = 'site-inspector-' + Date.now();
    const res = await request(app)
      .post(`/api/v1/organizations/${organization.id}/roles`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('x-organization-id', organization.id)
      .send({
        name: 'Site Inspector',
        slug: uniqueSlug,
        description: 'Can only inspect properties and create maintenance tickets',
        permissionKeys: ['property.read', 'maintenance.create', 'maintenance.read'],
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.slug).toBe(uniqueSlug);
    expect(res.body.data.permissions).toHaveLength(3);
  });

  test('rejects unauthorized member trying to perform an owner-only action (403 Forbidden)', async () => {
    // Manager tries to assign roles (manager does not have role.assign permission)
    const res = await request(app)
      .post(`/api/v1/organizations/${organization.id}/members`)
      .set('Authorization', `Bearer ${managerToken}`)
      .set('x-organization-id', organization.id)
      .send({
        mobile: '9876543210',
        roleSlug: 'accountant',
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('Forbidden');
  });
});
