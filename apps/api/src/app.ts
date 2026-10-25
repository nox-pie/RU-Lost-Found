import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { Router, type Express } from 'express';
import type { Container } from './container';
import { createErrorHandler } from './core/http/middleware/errorHandler';
import { notFound } from './core/http/middleware/notFound';
import { requestLogger } from './core/http/middleware/requestLogger';
import { createDocsRouter } from './docs/docs.routes';
import { buildOpenApiDocument } from './docs/openapi';
import { limitWrites, noStore, securityHeaders } from './core/http/middleware/security';

const API_PREFIX = '/api/v1';
const API_VERSION = '2.0.0';

/** Builds the Express application from an already-wired container. Starts nothing and opens no connections. */
export function createApp(container: Container): Express {
  const { env, logger, modules, rateLimiter } = container;
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', env.TRUST_PROXY_HOPS ?? 0);

  app.use(requestLogger(logger));
  app.use(securityHeaders());
  app.use(cors({ origin: env.CORS_ORIGINS, credentials: true }));
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  const api = Router();
  api.use(noStore);
  if (env.API_DOCS_ENABLED) {
    api.use(
      createDocsRouter(
        buildOpenApiDocument({
          title: `${env.BRAND_NAME} API`,
          version: API_VERSION,
          serverUrl: API_PREFIX,
        }),
      ),
    );
  }
  // Reads pass straight through: only requests that change data count towards this cap. Session
  // refreshes don't either: every signed-in browser sends them, and a whole campus (or a mobile
  // network) can share one address; they have their own limit.
  api.use(limitWrites(rateLimiter, env.WRITE_LIMIT_PER_MINUTE, ['/auth/refresh']));
  for (const module of modules) {
    for (const route of module.routes ?? []) api.use(route.path || '/', route.router);
  }
  if (container.localUploads) {
    // Development only: in production images are served by Cloudinary's CDN.
    api.use('/uploads', express.static(container.localUploads.directory, { maxAge: '1d' }));
  }
  app.use(API_PREFIX, api);

  app.use(notFound);
  app.use(createErrorHandler(container.errorReporter));

  return app;
}
