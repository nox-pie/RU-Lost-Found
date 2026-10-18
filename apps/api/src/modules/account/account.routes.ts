import { Router, type RequestHandler } from 'express';
import { deleteAccountSchema } from '@ru-lost-found/shared';
import { validate } from '../../core/http/middleware/validate';
import { rateLimit, type RateLimiter, type RateLimitRule } from '../../core/http/rateLimit';
import type { AccountController } from './account.controller';

const HOUR = 60 * 60;

const ACCOUNT_RATE_LIMITS = {
  exportPerUser: { name: 'account-export-user', limit: 10, windowSeconds: HOUR },
  deletePerUser: { name: 'account-delete-user', limit: 10, windowSeconds: HOUR },
} satisfies Record<string, RateLimitRule>;

/** The signed-in person's own account: download my data, delete my account. */
export function createAccountRouter(
  controller: AccountController,
  deps: { authenticate: RequestHandler; limiter: RateLimiter },
): Router {
  const router = Router();
  const byUser = (rule: RateLimitRule) => rateLimit(deps.limiter, rule, (req) => req.auth?.userId);
  router.use(deps.authenticate);
  router.get('/export', byUser(ACCOUNT_RATE_LIMITS.exportPerUser), controller.exportData);
  router.delete(
    '/',
    validate({ body: deleteAccountSchema }),
    byUser(ACCOUNT_RATE_LIMITS.deletePerUser),
    controller.deleteAccount,
  );
  return router;
}
