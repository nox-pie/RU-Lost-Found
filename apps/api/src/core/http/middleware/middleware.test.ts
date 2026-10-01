import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { serve } from '../../../testing/http';
import { createLogger } from '../../logger/logger';
import {
  ConflictError,
  ExternalServiceError,
  InvalidStateTransitionError,
  RateLimitError,
} from '../../errors/AppError';
import { RecordingErrorReporter } from '../../../testing/RecordingErrorReporter';
import { createErrorHandler, errorHandler } from './errorHandler';
import { notFound } from './notFound';
import { requestLogger } from './requestLogger';
import { validate } from './validate';

function buildApp(configure: (app: express.Express) => void) {
  const app = express();
  app.use(requestLogger(createLogger({ NODE_ENV: 'test', LOG_LEVEL: 'silent' })));
  app.use(express.json({ limit: '1kb' }));
  configure(app);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}

describe('error reporting', () => {
  it('reports unexpected errors with the request id, never expected ones', async () => {
    const reporter = new RecordingErrorReporter();
    const app = express();
    app.use(requestLogger(createLogger({ NODE_ENV: 'test', LOG_LEVEL: 'silent' })));
    app.get('/bug', () => {
      throw new TypeError('x is undefined');
    });
    app.get('/conflict', () => {
      throw new ConflictError('Already exists.');
    });
    app.get('/down', () => {
      throw new ExternalServiceError('Email');
    });
    app.use(createErrorHandler(reporter));
    const server = await serve(app);

    const bug = await request(server).get('/bug');
    await request(server).get('/conflict');
    await request(server).get('/down');

    expect(reporter.reports.map((r) => (r.error as Error).message)).toEqual([
      'x is undefined',
      'Email is temporarily unavailable.',
    ]);
    expect(reporter.reports[0]?.context).toMatchObject({
      area: 'http',
      requestId: bug.headers['x-request-id'],
      route: 'GET /bug',
    });
  });
});

describe('errorHandler', () => {
  it('maps an AppError to its status and code', async () => {
    const app = buildApp((a) =>
      a.get('/x', () => {
        throw new InvalidStateTransitionError('This claim can no longer be approved.');
      }),
    );

    const res = await request(await serve(app)).get('/x');

    expect(res.status).toBe(409);
    expect(res.body.error).toMatchObject({
      code: 'INVALID_STATE_TRANSITION',
      message: 'This claim can no longer be approved.',
    });
    expect(res.body.error.requestId).toBe(res.headers['x-request-id']);
  });

  it('keeps the parent status for subclasses and the generic code for the parent', async () => {
    const app = buildApp((a) =>
      a.get('/x', () => {
        throw new ConflictError('Already exists.');
      }),
    );

    const res = await request(await serve(app)).get('/x');

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('handles errors from async handlers', async () => {
    const app = buildApp((a) =>
      a.get('/x', async () => {
        throw new ExternalServiceError('Email service', new Error('timeout'));
      }),
    );

    const res = await request(await serve(app)).get('/x');

    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe('EXTERNAL_SERVICE_ERROR');
    expect(res.body.error.message).not.toMatch(/timeout/);
  });

  it('sets Retry-After for rate limit errors', async () => {
    const app = buildApp((a) =>
      a.get('/x', () => {
        throw new RateLimitError(42);
      }),
    );

    const res = await request(await serve(app)).get('/x');

    expect(res.status).toBe(429);
    expect(res.headers['retry-after']).toBe('42');
  });

  it('hides unexpected errors behind a generic 500', async () => {
    const app = buildApp((a) =>
      a.get('/x', () => {
        throw new Error('secret database detail');
      }),
    );

    const res = await request(await serve(app)).get('/x');

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL_ERROR');
    expect(JSON.stringify(res.body)).not.toMatch(/secret/);
  });

  it('rejects malformed JSON with a 400', async () => {
    const app = buildApp((a) => a.post('/x', (_req, res) => void res.json({})));

    const res = await request(await serve(app))
      .post('/x')
      .set('Content-Type', 'application/json')
      .send('{"broken":');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects oversized bodies with a 413', async () => {
    const app = buildApp((a) => a.post('/x', (_req, res) => void res.json({})));

    const res = await request(await serve(app))
      .post('/x')
      .send({ text: 'a'.repeat(2048) });

    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe('PAYLOAD_TOO_LARGE');
  });
});

describe('notFound', () => {
  it('returns a JSON 404 for unknown routes', async () => {
    const res = await request(await serve(buildApp(() => {}))).get('/nope');

    expect(res.status).toBe(404);
    expect(res.body.error).toMatchObject({
      code: 'NOT_FOUND',
      message: 'Route GET /nope not found.',
    });
  });
});

describe('requestLogger', () => {
  it('reuses a well-formed incoming request id', async () => {
    const res = await request(await serve(buildApp(() => {})))
      .get('/nope')
      .set('X-Request-Id', 'trace-123');

    expect(res.headers['x-request-id']).toBe('trace-123');
  });

  it('replaces an unsafe incoming request id', async () => {
    const res = await request(await serve(buildApp(() => {})))
      .get('/nope')
      .set('X-Request-Id', '<script>');

    expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe('validate', () => {
  const schemas = {
    params: z.object({ id: z.string().regex(/^\d+$/, 'must be numeric') }),
    query: z.object({ limit: z.coerce.number().int().max(50).default(20) }),
    body: z.object({ title: z.string().min(3) }).strict(),
  };

  const app = buildApp((a) =>
    a.post('/items/:id', validate(schemas), (req, res) => {
      res.json({ params: req.params, query: req.query, body: req.body });
    }),
  );

  it('passes parsed values with defaults and coercion to the handler', async () => {
    const res = await request(await serve(app))
      .post('/items/7?limit=5')
      .send({ title: 'Blue bottle' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      params: { id: '7' },
      query: { limit: 5 },
      body: { title: 'Blue bottle' },
    });
  });

  it('applies query defaults', async () => {
    const res = await request(await serve(app))
      .post('/items/7')
      .send({ title: 'Blue bottle' });

    expect(res.body.query).toEqual({ limit: 20 });
  });

  it('reports every invalid field with its location', async () => {
    const res = await request(await serve(app))
      .post('/items/abc?limit=500')
      .send({ title: 'x', extra: true });

    expect(res.status).toBe(400);
    const paths = res.body.error.details.map((d: { path: string }) => d.path);
    expect(paths).toEqual(
      expect.arrayContaining(['params.id', 'query.limit', 'body.title', 'body']),
    );
  });
});
