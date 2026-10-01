import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { useTestApp } from '../testing/testApp';
import { OPERATIONS } from './openapi';

const t = useTestApp();
const api = () => request(t.app);
const SOME_ID = '0123456789abcdef01234567';

describe('API documentation', () => {
  it('documents only routes that exist (none of them answers 404 Not Found)', async () => {
    for (const op of OPERATIONS) {
      const path = `/api/v1${op.path.replace(/:\w+/g, SOME_ID)}`;
      const res = await api()[op.method](path);

      expect.soft(res.status, `${op.method.toUpperCase()} ${op.path}`).not.toBe(404);
      // Without a token, every operation for signed-in users must refuse the request.
      // (Signing out without a session is allowed: it is idempotent.)
      if (op.access !== 'public' && op.access !== 'cookie') {
        expect.soft(res.status, `${op.method.toUpperCase()} ${op.path}`).toBe(401);
      }
    }
  });

  it('serves the OpenAPI document with every operation', async () => {
    const res = await api().get('/api/v1/openapi.json').expect(200);

    expect(res.body.openapi).toBe('3.1.0');
    const operations = Object.values(res.body.paths as Record<string, object>).flatMap((path) =>
      Object.keys(path),
    );
    expect(operations).toHaveLength(OPERATIONS.length);
    expect(res.body.paths['/items/{id}'].get.security).toEqual([{ bearerAuth: [] }]);
    expect(res.body.components.schemas.Error).toBeDefined();
  });

  it('serves Swagger UI with a policy that allows only this origin’s scripts', async () => {
    const page = await api().get('/api/v1/docs').expect(200);

    expect(page.headers['content-security-policy']).toContain("script-src 'self'");
    expect(page.headers['content-security-policy']).not.toContain(
      "script-src 'self' 'unsafe-inline'",
    );
    expect(page.text).toContain('docs/assets/swagger-ui-bundle.js');
    await api()
      .get('/api/v1/docs/init.js')
      .expect(200)
      .expect('Content-Type', /javascript/);
    await api()
      .get('/api/v1/docs/assets/swagger-ui-bundle.js')
      .expect(200)
      .expect('Content-Type', /javascript/);
  });
});
