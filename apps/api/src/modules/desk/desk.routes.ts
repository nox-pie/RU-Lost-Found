import { Router, type RequestHandler } from 'express';
import { deskItemsQuerySchema, pageQuerySchema } from '@ru-lost-found/shared';
import { validate } from '../../core/http/middleware/validate';
import type { ClaimController } from '../claims/claim.controller';
import type { ItemController } from '../items/item.controller';

/**
 * The security desk console: what the desk is waiting to hand over. For security desk staff and
 * admins; `requireStaff` checks the role stored now, not the one in the access token.
 * Confirming a handover uses the claim's own endpoint (POST /claims/:id/handover/staff).
 */
export function createDeskRouter(deps: {
  claims: ClaimController;
  items: ItemController;
  authenticate: RequestHandler;
  requireStaff: RequestHandler;
}): Router {
  const router = Router();
  router.use(deps.authenticate, deps.requireStaff);
  router.get('/handovers', validate({ query: pageQuerySchema }), deps.claims.listAwaitingHandover);
  router.get('/items', validate({ query: deskItemsQuerySchema }), deps.items.listAtDesk);
  return router;
}
