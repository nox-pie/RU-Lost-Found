import { Router, type RequestHandler } from 'express';
import {
  changeRoleSchema,
  itemIdParamsSchema,
  listAdminItemsQuerySchema,
  listAuditQuerySchema,
  listReportsQuerySchema,
  listUsersQuerySchema,
  moderateItemSchema,
  removePostSchema,
  suspendUserSchema,
  userIdParamsSchema,
} from '@ru-lost-found/shared';
import { validate } from '../../core/http/middleware/validate';
import type { ModerationController } from '../moderation/moderation.controller';
import type { AdminController } from './admin.controller';

/**
 * Everything under /admin is for university admins. `requireAdmin` checks the role stored now,
 * not the one in the (up to 15 minutes old) access token.
 */
export function createAdminRouter(deps: {
  admin: AdminController;
  moderation: ModerationController;
  authenticate: RequestHandler;
  requireAdmin: RequestHandler;
}): Router {
  const { admin, moderation } = deps;
  const router = Router();
  router.use(deps.authenticate, deps.requireAdmin);

  router.get('/stats', admin.stats);

  router.get('/users', validate({ query: listUsersQuerySchema }), admin.listUsers);
  router.patch(
    '/users/:id/role',
    validate({ params: userIdParamsSchema, body: changeRoleSchema }),
    admin.changeRole,
  );
  router.post(
    '/users/:id/suspend',
    validate({ params: userIdParamsSchema, body: suspendUserSchema }),
    admin.suspend,
  );
  router.post('/users/:id/reactivate', validate({ params: userIdParamsSchema }), admin.reactivate);

  router.get('/audit', validate({ query: listAuditQuerySchema }), admin.activity);

  router.get('/items', validate({ query: listAdminItemsQuerySchema }), admin.listItems);
  router.post(
    '/items/:id/remove',
    validate({ params: itemIdParamsSchema, body: removePostSchema }),
    moderation.removePost,
  );

  router.get('/reports', validate({ query: listReportsQuerySchema }), moderation.list);
  router.post(
    '/items/:id/moderation',
    validate({ params: itemIdParamsSchema, body: moderateItemSchema }),
    moderation.moderateItem,
  );

  return router;
}
