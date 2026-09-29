import request from 'supertest';
import { createApp } from '../src/app.js';

const app = createApp();

describe('application routes', () => {
  test('reports service health with standard response format', async () => {
    const response = await request(app).get('/api/v1/health');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.status).toBe('ok');
    expect(response.body.message).toBe('RENTMATE API is running smoothly');
  });

  test('returns a consistent standardized response for unknown routes', async () => {
    const response = await request(app).get('/missing');

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
    expect(response.body.statusCode).toBe(404);
    expect(response.body.message).toContain('Route not found');
  });

  test('root route returns welcome message', async () => {
    const response = await request(app).get('/');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.name).toBe('RENTMATE API');
  });
});