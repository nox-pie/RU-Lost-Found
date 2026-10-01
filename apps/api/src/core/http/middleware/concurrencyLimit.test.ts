import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { serve } from '../../../testing/http';
import { createLogger } from '../../logger/logger';
import { limitConcurrency } from './concurrencyLimit';
import { errorHandler } from './errorHandler';
import { requestLogger } from './requestLogger';

describe('limitConcurrency', () => {
  it('turns away requests beyond the limit with 503 and frees slots when requests finish', async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => (release = resolve));
    const app = express();
    app.use(requestLogger(createLogger({ NODE_ENV: 'test', LOG_LEVEL: 'silent' })));
    app.post('/upload', limitConcurrency(2), async (_req, res) => {
      await gate;
      res.json({ ok: true });
    });
    app.use(errorHandler);
    const server = await serve(app);

    const slow = [request(server).post('/upload'), request(server).post('/upload')].map((r) =>
      r.then((res) => res.status),
    );
    await new Promise((resolve) => setTimeout(resolve, 50));
    const third = await request(server).post('/upload');
    release();

    expect(third.status).toBe(503);
    expect(third.headers['retry-after']).toBe('5');
    expect(third.body.error.code).toBe('SERVICE_BUSY');
    expect(await Promise.all(slow)).toEqual([200, 200]);
    expect((await request(server).post('/upload')).status).toBe(200);
  });
});
