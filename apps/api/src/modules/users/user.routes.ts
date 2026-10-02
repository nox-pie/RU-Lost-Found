import { Router, type RequestHandler } from 'express';
import { updateProfileSchema } from '@ru-lost-found/shared';
import { imageUpload } from '../../core/http/middleware/imageUpload';
import { validate } from '../../core/http/middleware/validate';
import { rateLimit, type RateLimiter, type RateLimitRule } from '../../core/http/rateLimit';
import type { UserController } from './user.controller';

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

const USER_RATE_LIMITS = {
  avatarPerUser: { name: 'avatar-user', limit: 20, windowSeconds: 24 * 60 * 60 },
} satisfies Record<string, RateLimitRule>;

export function createUserRouter(
  controller: UserController,
  deps: { authenticate: RequestHandler; limiter: RateLimiter; uploadSlot: RequestHandler },
): Router {
  const router = Router();
  router.use(deps.authenticate);
  router.get('/me', controller.getMe);
  router.patch('/me', validate({ body: updateProfileSchema }), controller.updateMe);
  router.put(
    '/me/avatar',
    rateLimit(deps.limiter, USER_RATE_LIMITS.avatarPerUser, (req) => req.auth?.userId),
    deps.uploadSlot,
    imageUpload({ field: 'avatar', maxFiles: 1, maxBytesPerFile: MAX_AVATAR_BYTES }),
    controller.changeAvatar,
  );
  router.delete('/me/avatar', controller.removeAvatar);
  return router;
}
