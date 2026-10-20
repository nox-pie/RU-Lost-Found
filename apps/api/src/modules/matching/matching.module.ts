import type { AppModule } from '../../core/modules/AppModule';
import type { Kernel } from '../kernel';
import type { NotificationEmails } from '../notifications/notification.emails';
import type { NotificationService } from '../notifications/notification.service';
import { TellOwnersOfLikelyFinds } from './handlers/TellOwnersOfLikelyFinds';
import { MatchingController } from './matching.controller';
import { createMatchingRouter } from './matching.routes';
import { MatchingService } from './matching.service';

/** Smart matching: likely matches on a post's page, and owners told about likely finds. */
export function createMatchingModule(
  kernel: Kernel,
  deps: { notifications: NotificationService; emails: NotificationEmails },
): AppModule {
  const { repositories, http } = kernel;
  const service = new MatchingService(repositories.items, repositories.users);
  return {
    name: 'matching',
    routes: [
      {
        path: '',
        router: createMatchingRouter(new MatchingController(service), http.authenticate),
      },
    ],
    handlers: [
      new TellOwnersOfLikelyFinds(service, repositories.items, deps.notifications, deps.emails),
    ],
  };
}
