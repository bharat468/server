import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/config/database.config.js';

const app = createApp();

describe('Authentication Module Integration Tests', () => {
  const testMobile = '9876501234';
  let authToken;

  beforeAll(async () => {
    // Clean up test data before running
    await prisma.otp.deleteMany({ where: { mobile: testMobile } });
    await prisma.user.deleteMany({ where: { mobile: testMobile } });
  });

  afterAll(async () => {
    // Cleanup after tests
    await prisma.otp.deleteMany({ where: { mobile: testMobile } });
    await prisma.user.deleteMany({ where: { mobile: testMobile } });
    await prisma.$disconnect();
  });

  test('rejects send-otp when mobile is invalid', async () => {
    const response = await request(app)
      .post('/api/v1/auth/send-otp')
      .send({ mobile: '12345' });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  test('successfully generates and stores OTP on valid mobile', async () => {
    const response = await request(app)
      .post('/api/v1/auth/send-otp')
      .send({ mobile: testMobile });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.mobile).toBe(testMobile);

    // Verify OTP exists in DB
    const storedOtp = await prisma.otp.findFirst({
      where: { mobile: testMobile, isUsed: false },
    });

    expect(storedOtp).toBeDefined();
    expect(storedOtp.otp).toHaveLength(6);
  });

  test('rejects verify-otp with incorrect OTP', async () => {
    const response = await request(app)
      .post('/api/v1/auth/verify-otp')
      .send({ mobile: testMobile, otp: '000000' });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toContain('Invalid or expired OTP');
  });

  test('successfully verifies OTP, auto-creates user, and issues JWT', async () => {
    // Fetch generated OTP from database
    const storedOtp = await prisma.otp.findFirst({
      where: { mobile: testMobile, isUsed: false },
    });

    const response = await request(app)
      .post('/api/v1/auth/verify-otp')
      .send({ mobile: testMobile, otp: storedOtp.otp });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.token).toBeDefined();
    expect(response.body.data.user.mobile).toBe(testMobile);
    expect(response.body.data.isNewUser).toBe(true);

    authToken = response.body.data.token;
  });

  test('prevents re-using the same OTP (single-use guarantee)', async () => {
    const storedOtp = await prisma.otp.findFirst({
      where: { mobile: testMobile },
      orderBy: { createdAt: 'desc' },
    });

    const response = await request(app)
      .post('/api/v1/auth/verify-otp')
      .send({ mobile: testMobile, otp: storedOtp.otp });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  test('rejects /api/v1/auth/me when Bearer token is missing', async () => {
    const response = await request(app).get('/api/v1/auth/me');

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
  });

  test('successfully fetches authenticated profile via GET /api/v1/auth/me', async () => {
    const response = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${authToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.user.mobile).toBe(testMobile);
  });

  test('successfully handles logout', async () => {
    const response = await request(app)
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${authToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.message).toContain('Logged out');
  });
});
