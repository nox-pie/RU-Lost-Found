import { Router, type RequestHandler } from 'express';
import { listNotificationsQuerySchema, markNotificationsReadSchema } from '@ru-lost-found/shared';
import { validate } from '../../core/http/middleware/validate';
import type { NotificationController } from './notification.controller';

export function createNotificationRouter(
  controller: NotificationController,
  authenticate: RequestHandler,
): Router {
  const router = Router();
  router.use(authenticate);
  router.get('/', validate({ query: listNotificationsQuerySchema }), controller.list);
  router.post('/read', validate({ body: markNotificationsReadSchema }), controller.markRead);
  return router;
}
