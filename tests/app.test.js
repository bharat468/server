import request from 'supertest';
import { createApp } from '../src/app.js';

const app = createApp();

describe('application routes', () => {
  test('reports service health with standard response format including path and statusCode', async () => {
    const response = await request(app).get('/api/v1/health');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.statusCode).toBe(200);
    expect(response.body.path).toBe('/api/v1/health');
    expect(response.body.timestamp).toBeDefined();
    expect(response.body.data.status).toBe('ok');
    expect(response.body.message).toBe('RENTMATE API is running smoothly');
  });

  test('returns a consistent standardized response with dynamic path for unknown routes', async () => {
    const response = await request(app).get('/missing?query=example');

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
    expect(response.body.statusCode).toBe(404);
    expect(response.body.path).toBe('/missing?query=example');
    expect(response.body.timestamp).toBeDefined();
    expect(response.body.message).toContain('Route not found');
  });

  test('root route returns welcome message with dynamic path and statusCode', async () => {
    const response = await request(app).get('/?test=1');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.statusCode).toBe(200);
    expect(response.body.path).toBe('/?test=1');
    expect(response.body.data.name).toBe('RENTMATE API');
  });
});