import { Router, type RequestHandler } from 'express';
import {
  approveClaimSchema,
  claimIdParamsSchema,
  handoverSchema,
  itemIdParamsSchema,
  listClaimsQuerySchema,
  rejectClaimSchema,
  submitClaimSchema,
} from '@ru-lost-found/shared';
import { authorize } from '../../core/http/auth';
import { validate } from '../../core/http/middleware/validate';
import { rateLimit, type RateLimiter, type RateLimitRule } from '../../core/http/rateLimit';
import type { ClaimController } from './claim.controller';

const CLAIM_RATE_LIMITS = {
  claimsPerUser: { name: 'claim-submit-user', limit: 30, windowSeconds: 24 * 60 * 60 },
  handoverPerUser: { name: 'claim-handover-user', limit: 30, windowSeconds: 60 * 60 },
} satisfies Record<string, RateLimitRule>;

/** Mounted at the API root: claims are created under their item, then addressed by their own id. */
export function createClaimRouter(
  controller: ClaimController,
  authenticate: RequestHandler,
  limiter: RateLimiter,
): Router {
  const router = Router();
  const byUser = (rule: RateLimitRule) => rateLimit(limiter, rule, (req) => req.auth?.userId);

  router.post(
    '/items/:id/claims',
    authenticate,
    byUser(CLAIM_RATE_LIMITS.claimsPerUser),
    validate({ params: itemIdParamsSchema, body: submitClaimSchema }),
    controller.submit,
  );
  router.get(
    '/items/:id/claims',
    authenticate,
    validate({ params: itemIdParamsSchema, query: listClaimsQuerySchema }),
    controller.listForItem,
  );

  const claims = Router();
  claims.use(authenticate);
  claims.get('/mine', validate({ query: listClaimsQuerySchema }), controller.listMine);
  claims.get('/received', validate({ query: listClaimsQuerySchema }), controller.listReceived);
  claims.get('/:id', validate({ params: claimIdParamsSchema }), controller.get);
  claims.post(
    '/:id/approve',
    validate({ params: claimIdParamsSchema, body: approveClaimSchema }),
    controller.approve,
  );
  claims.post(
    '/:id/reject',
    validate({ params: claimIdParamsSchema, body: rejectClaimSchema }),
    controller.reject,
  );
  claims.post('/:id/cancel', validate({ params: claimIdParamsSchema }), controller.cancel);
  claims.post(
    '/:id/handover',
    byUser(CLAIM_RATE_LIMITS.handoverPerUser),
    validate({ params: claimIdParamsSchema, body: handoverSchema }),
    controller.confirmHandover,
  );
  claims.post(
    '/:id/handover/staff',
    authorize('SECURITY_DESK', 'UNIVERSITY_ADMIN', 'PLATFORM_ADMIN'),
    validate({ params: claimIdParamsSchema }),
    controller.confirmHandoverAsStaff,
  );
  router.use('/claims', claims);

  return router;
}
