import { Router, type RequestHandler } from 'express';
import {
  MAX_ITEM_PHOTOS,
  MAX_PHOTO_BYTES,
  createItemSchema,
  itemCountsQuerySchema,
  itemIdParamsSchema,
  listItemsQuerySchema,
  pageQuerySchema,
  updateItemSchema,
} from '@ru-lost-found/shared';
import { imageUpload } from '../../core/http/middleware/imageUpload';
import { validate } from '../../core/http/middleware/validate';
import { rateLimit, type RateLimiter, type RateLimitRule } from '../../core/http/rateLimit';
import type { ItemController } from './item.controller';

export const ITEM_RATE_LIMITS = {
  reportsPerUser: { name: 'item-report-user', limit: 20, windowSeconds: 24 * 60 * 60 },
} satisfies Record<string, RateLimitRule>;

export function createItemRouter(
  controller: ItemController,
  deps: { authenticate: RequestHandler; limiter: RateLimiter; uploadSlot: RequestHandler },
): Router {
  const { authenticate, limiter, uploadSlot } = deps;
  const router = Router();
  router.use(authenticate);

  router.get('/', validate({ query: listItemsQuerySchema }), controller.list);
  router.get('/mine', validate({ query: pageQuerySchema }), controller.listMine);
  router.get('/counts', validate({ query: itemCountsQuerySchema }), controller.counts);
  router.post(
    '/',
    rateLimit(limiter, ITEM_RATE_LIMITS.reportsPerUser, (req) => req.auth?.userId),
    uploadSlot,
    imageUpload({ field: 'photos', maxFiles: MAX_ITEM_PHOTOS, maxBytesPerFile: MAX_PHOTO_BYTES }),
    validate({ body: createItemSchema }),
    controller.create,
  );
  router.get('/:id', validate({ params: itemIdParamsSchema }), controller.get);
  router.patch(
    '/:id',
    validate({ params: itemIdParamsSchema, body: updateItemSchema }),
    controller.update,
  );
  router.delete('/:id', validate({ params: itemIdParamsSchema }), controller.remove);

  return router;
}
