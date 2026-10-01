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
import { createAdminRouter } from './modules/admin/admin.routes';
import { createAuthRouter } from './modules/auth/auth.routes';
import { createClaimRouter } from './modules/claims/claim.routes';
import { createHealthRouter } from './modules/health/health.routes';
import { createItemRouter } from './modules/items/item.routes';
import { createModerationRouter } from './modules/moderation/moderation.routes';
import { createNotificationRouter } from './modules/notifications/notification.routes';
import { createUniversityRouter } from './modules/universities/university.controller';
import { createUserRouter } from './modules/users/user.routes';

export const API_PREFIX = '/api/v1';
export const API_VERSION = '2.0.0';

/** Builds the Express application from an already-wired container. Starts nothing and opens no connections. */
export function createApp(container: Container): Express {
  const { env, logger, controllers, middleware } = container;
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
  api.use('/health', createHealthRouter(controllers.health));
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
  api.use(limitWrites(middleware.rateLimiter));
  api.use('/auth', createAuthRouter(controllers.auth, middleware.rateLimiter, env.CORS_ORIGINS));
  api.use(
    '/users',
    createUserRouter(controllers.users, {
      authenticate: middleware.authenticate,
      limiter: middleware.rateLimiter,
      uploadSlot: middleware.uploadSlot,
    }),
  );
  api.use(
    '/items',
    createItemRouter(controllers.items, {
      authenticate: middleware.authenticate,
      limiter: middleware.rateLimiter,
      uploadSlot: middleware.uploadSlot,
    }),
  );
  api.use(
    '/notifications',
    createNotificationRouter(controllers.notifications, middleware.authenticate),
  );
  api.use(
    '/universities',
    createUniversityRouter(controllers.universities, middleware.authenticate),
  );
  api.use(createClaimRouter(controllers.claims, middleware.authenticate, middleware.rateLimiter));
  api.use(
    createModerationRouter(controllers.moderation, middleware.authenticate, middleware.rateLimiter),
  );
  api.use(
    '/admin',
    createAdminRouter({
      admin: controllers.admin,
      moderation: controllers.moderation,
      authenticate: middleware.authenticate,
      requireAdmin: middleware.requireAdmin,
    }),
  );
  if (container.localUploads) {
    // Development only: in production images are served by Cloudinary's CDN.
    api.use('/uploads', express.static(container.localUploads.directory, { maxAge: '1d' }));
  }
  app.use(API_PREFIX, api);

  app.use(notFound);
  app.use(createErrorHandler(container.errorReporter));

  return app;
}
