import { Router, type RequestHandler } from 'express';
import { flagItemSchema, itemIdParamsSchema } from '@ru-lost-found/shared';
import { validate } from '../../core/http/middleware/validate';
import { rateLimit, type RateLimiter, type RateLimitRule } from '../../core/http/rateLimit';
import type { ModerationController } from './moderation.controller';

const MODERATION_RATE_LIMITS = {
  flagsPerUser: { name: 'item-flag-user', limit: 20, windowSeconds: 24 * 60 * 60 },
} satisfies Record<string, RateLimitRule>;

/** Mounted at the API root, like claims: a report is filed under the post it is about. */
export function createModerationRouter(
  controller: ModerationController,
  authenticate: RequestHandler,
  limiter: RateLimiter,
): Router {
  const router = Router();
  router.post(
    '/items/:id/reports',
    authenticate,
    rateLimit(limiter, MODERATION_RATE_LIMITS.flagsPerUser, (req) => req.auth?.userId),
    validate({ params: itemIdParamsSchema, body: flagItemSchema }),
    controller.flag,
  );
  return router;
}
