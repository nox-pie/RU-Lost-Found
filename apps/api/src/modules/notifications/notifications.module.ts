import type { AppModule } from '../../core/modules/AppModule';
import type { Kernel } from '../kernel';
import { AccountSecurityHandler } from './handlers/AccountSecurityHandler';
import { ClaimNotificationHandler } from './handlers/ClaimNotificationHandler';
import { ItemModerationHandler } from './handlers/ItemModerationHandler';
import { NotificationController } from './notification.controller';
import { NotificationEmails } from './notification.emails';
import { createNotificationRouter } from './notification.routes';
import { NotificationService } from './notification.service';

export function createNotificationsModule(kernel: Kernel) {
  const { env, repositories, emailSender, emailLayout, ids, clock, http } = kernel;
  const emails = new NotificationEmails(emailLayout, env.APP_URL);
  const service = new NotificationService(
    repositories.notifications,
    repositories.users,
    emailSender,
    ids,
    clock,
  );
  const module: AppModule = {
    name: 'notifications',
    routes: [
      {
        path: '/notifications',
        router: createNotificationRouter(new NotificationController(service), http.authenticate),
      },
    ],
    handlers: [
      new ClaimNotificationHandler(
        service,
        repositories.claims,
        repositories.items,
        repositories.users,
        emails,
      ),
      new AccountSecurityHandler(repositories.users, emailSender, emails),
      new ItemModerationHandler(service, repositories.items, emails),
    ],
  };
  return { module, emails };
}
