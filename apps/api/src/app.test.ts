import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { FakeHealthIndicator, useTestApp } from './testing/testApp';

const redis = new FakeHealthIndicator('redis');
const t = useTestApp({ healthIndicators: [redis] });

describe('API app', () => {
  it('GET /api/v1/health/live reports the process is up', async () => {
    const res = await request(t.app).get('/api/v1/health/live');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok', uptimeSeconds: expect.any(Number) });
  });

  it('GET /api/v1/health/ready returns 200 when dependencies are up', async () => {
    redis.healthy = true;

    const res = await request(t.app).get('/api/v1/health/ready');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', checks: { redis: 'up' } });
  });

  it('GET /api/v1/health/ready returns 503 when a dependency is down', async () => {
    redis.healthy = false;

    const res = await request(t.app).get('/api/v1/health/ready');

    expect(res.status).toBe(503);
    expect(res.body.checks).toEqual({ redis: 'down' });
  });

  it('sets security headers and hides the framework', async () => {
    const res = await request(t.app).get('/api/v1/health/live');

    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('allows configured browser origins only, with credentials', async () => {
    const allowed = await request(t.app)
      .get('/api/v1/health/live')
      .set('Origin', 'http://localhost:5173');
    const blocked = await request(t.app)
      .get('/api/v1/health/live')
      .set('Origin', 'https://evil.example');

    expect(allowed.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(allowed.headers['access-control-allow-credentials']).toBe('true');
    expect(blocked.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('returns a JSON 404 for unknown API routes', async () => {
    const res = await request(t.app).get('/api/v1/nope');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
