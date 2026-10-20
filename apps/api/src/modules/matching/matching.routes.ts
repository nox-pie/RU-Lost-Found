import { Router, type RequestHandler } from 'express';
import { itemIdParamsSchema } from '@ru-lost-found/shared';
import { validate } from '../../core/http/middleware/validate';
import type { MatchingController } from './matching.controller';

/** Mounted at the API root: a post's matches live under the post. */
export function createMatchingRouter(
  controller: MatchingController,
  authenticate: RequestHandler,
): Router {
  const router = Router();
  router.get(
    '/items/:id/matches',
    authenticate,
    validate({ params: itemIdParamsSchema }),
    controller.forItem,
  );
  return router;
}
