import { Router, type RequestHandler } from 'express';
import { deskItemsQuerySchema, pageQuerySchema } from '@ru-lost-found/shared';
import { validate } from '../../core/http/middleware/validate';
import type { DeskController } from './desk.controller';

/**
 * The security desk console: what the desk is waiting to hand over. For security desk staff and
 * admins; `requireStaff` checks the role stored now, not the one in the access token.
 * Confirming a handover uses the claim's own endpoint (POST /claims/:id/handover/staff).
 */
export function createDeskRouter(
  controller: DeskController,
  deps: {
    authenticate: RequestHandler;
    requireStaff: RequestHandler;
  },
): Router {
  const router = Router();
  router.use(deps.authenticate, deps.requireStaff);
  router.get('/handovers', validate({ query: pageQuerySchema }), controller.listHandovers);
  router.get('/items', validate({ query: deskItemsQuerySchema }), controller.listItems);
  router.get('/claims', validate({ query: pageQuerySchema }), controller.listClaims);
  return router;
}
