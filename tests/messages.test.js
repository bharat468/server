import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app.js';
import { prisma, initSupportMessagesTable } from '../src/config/database.config.js';
import { env } from '../src/config/env.config.js';

const app = createApp();

describe('Messages & Support Inquiries Module Tests', () => {
  let adminUser;
  let adminToken;
  let regularUser;
  let regularToken;
  let createdMessageId;

  beforeAll(async () => {
    await initSupportMessagesTable();

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

    // Regular tenant/landlord user
    regularUser = await prisma.user.upsert({
      where: { mobile: '9000022222' },
      update: {},
      create: {
        mobile: '9000022222',
        name: 'Demo Landlord User',
        email: 'landlord@test.local',
        status: 'ACTIVE',
      },
    });

    regularToken = jwt.sign(
      { id: regularUser.id, mobile: regularUser.mobile, status: regularUser.status },
      env.JWT_SECRET,
      { expiresIn: '1d' }
    );
  });

  describe('1. Public & User Message Submission', () => {
    it('should allow public visitor to submit inquiry without token', async () => {
      const res = await request(app)
        .post('/api/v1/messages')
        .send({
          name: 'Vikas Gupta',
          mobile: '9812345678',
          email: 'vikas@example.com',
          subject: 'Pricing for 50 flats',
          message: 'Hello, I want to manage 50 flats across 2 buildings. Please call me.',
          category: 'ENTERPRISE_PLAN',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data.senderName).toBe('Vikas Gupta');
      expect(res.body.data.senderPhone).toBe('9812345678');
      expect(res.body.data.status).toBe('UNREAD');
      expect(res.body.data.userRole).toBe('VISITOR');
      createdMessageId = res.body.data.id;
    });

    it('should reject invalid submission missing name or message', async () => {
      const res = await request(app)
        .post('/api/v1/messages')
        .send({
          name: '',
          mobile: '123',
          message: '',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should automatically attach authenticated user identity when logged in', async () => {
      const res = await request(app)
        .post('/api/v1/messages')
        .set('Authorization', `Bearer ${regularToken}`)
        .send({
          subject: 'Help with GST invoice',
          message: 'Need help downloading August payment GST receipts.',
          category: 'BILLING',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.userId).toBe(regularUser.id);
      expect(res.body.data.senderPhone).toBe('9000022222');
    });

    it('should allow authenticated user to retrieve their own messages', async () => {
      const res = await request(app)
        .get('/api/v1/messages/my')
        .set('Authorization', `Bearer ${regularToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('2. SuperAdmin Message Management & Access Control', () => {
    it('should reject regular user from viewing admin messages list', async () => {
      const res = await request(app)
        .get('/api/v1/messages')
        .set('Authorization', `Bearer ${regularToken}`);

      expect(res.status).toBe(403);
    });

    it('should allow SuperAdmin to view messages metrics and list', async () => {
      const metricsRes = await request(app)
        .get('/api/v1/messages/metrics')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(metricsRes.status).toBe(200);
      expect(metricsRes.body.data).toHaveProperty('total');
      expect(metricsRes.body.data).toHaveProperty('unread');

      const listRes = await request(app)
        .get('/api/v1/messages')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(listRes.status).toBe(200);
      expect(listRes.body.data).toHaveProperty('messages');
      expect(listRes.body.data.messages.length).toBeGreaterThanOrEqual(1);
    });

    it('should allow SuperAdmin to view message detail and auto-mark as read', async () => {
      const res = await request(app)
        .get(`/api/v1/messages/${createdMessageId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(createdMessageId);
      expect(res.body.data.status).toBe('READ');
    });

    it('should allow SuperAdmin to reply to user message', async () => {
      const res = await request(app)
        .post(`/api/v1/messages/${createdMessageId}/reply`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          replyMessage: 'Hi Vikas, our representative will call you on +91 9812345678 at 3 PM today.',
          markResolved: true,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('RESOLVED');
      expect(res.body.data.replies.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data.replies[0].message).toContain('Hi Vikas');
    });

    it('should allow SuperAdmin to update status and delete message', async () => {
      const updateRes = await request(app)
        .patch(`/api/v1/messages/${createdMessageId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'ARCHIVED' });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.status).toBe('ARCHIVED');

      const delRes = await request(app)
        .delete(`/api/v1/messages/${createdMessageId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(delRes.status).toBe(200);
    });
  });
});
