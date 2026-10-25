import type { Clock } from '../../core/domain/Clock';
import type { AppModule } from '../../core/modules/AppModule';
import type { Kernel } from '../kernel';
import { ModerationController } from './moderation.controller';
import { createModerationRouter } from './moderation.routes';
import { ModerationService } from './moderation.service';

export function createModerationService(
  kernel: Kernel,
  clock: Clock = kernel.clock,
): ModerationService {
  const { repositories, unitOfWork, ids } = kernel;
  return new ModerationService({
    reports: repositories.reports,
    items: repositories.items,
    users: repositories.users,
    unitOfWork,
    ids,
    clock,
  });
}

export function createModerationModule(kernel: Kernel) {
  const { http } = kernel;
  const controller = new ModerationController(createModerationService(kernel));
  const module: AppModule = {
    name: 'moderation',
    // Flagging is POST /items/:id/reports; the admin side is mounted by the admin module.
    routes: [
      { path: '', router: createModerationRouter(controller, http.authenticate, http.rateLimiter) },
    ],
  };
  return { module, controller };
}
