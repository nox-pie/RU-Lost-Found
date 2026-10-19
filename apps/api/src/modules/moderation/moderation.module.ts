import type { AppModule } from '../../core/modules/AppModule';
import type { Kernel } from '../kernel';
import { ModerationController } from './moderation.controller';
import { createModerationRouter } from './moderation.routes';
import { ModerationService } from './moderation.service';

export function createModerationModule(kernel: Kernel) {
  const { repositories, unitOfWork, ids, clock, http } = kernel;
  const controller = new ModerationController(
    new ModerationService({
      reports: repositories.reports,
      items: repositories.items,
      users: repositories.users,
      unitOfWork,
      ids,
      clock,
    }),
  );
  const module: AppModule = {
    name: 'moderation',
    // Flagging is POST /items/:id/reports; the admin side is mounted by the admin module.
    routes: [
      { path: '', router: createModerationRouter(controller, http.authenticate, http.rateLimiter) },
    ],
  };
  return { module, controller };
}
