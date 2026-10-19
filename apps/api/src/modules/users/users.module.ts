import type { AppModule } from '../../core/modules/AppModule';
import type { Kernel } from '../kernel';
import { AdminAccounts } from './AdminAccounts';
import { UserController } from './user.controller';
import { createUserRouter } from './user.routes';
import { UserService } from './user.service';

export function createUsersModule(kernel: Kernel) {
  const { env, repositories, storage, clock, logger, http } = kernel;
  const service = new UserService(
    repositories.users,
    repositories.universities,
    storage,
    clock,
    logger,
  );
  const module: AppModule = {
    name: 'users',
    routes: [
      {
        path: '/users',
        router: createUserRouter(new UserController(service), {
          authenticate: http.authenticate,
          limiter: http.rateLimiter,
          uploadSlot: http.uploadSlot,
        }),
      },
    ],
  };
  return {
    module,
    adminAccounts: new AdminAccounts(env.ADMIN_EMAILS, repositories.users, clock, logger),
  };
}
