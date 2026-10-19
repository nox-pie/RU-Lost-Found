import type { AppModule } from '../../core/modules/AppModule';
import type { LoginThrottle } from '../auth/LoginThrottle';
import type { ClaimService } from '../claims/claim.service';
import type { ItemService } from '../items/item.service';
import type { Kernel } from '../kernel';
import type { NotificationEmails } from '../notifications/notification.emails';
import { AccountController } from './account.controller';
import { createAccountRouter } from './account.routes';
import { AccountService } from './account.service';

/** The person's own account as a whole: download my data, delete my account. */
export function createAccountModule(
  kernel: Kernel,
  deps: {
    itemService: ItemService;
    claimService: ClaimService;
    loginThrottle: LoginThrottle;
    emails: NotificationEmails;
  },
): AppModule {
  const { repositories, storage, passwords, emailSender, clock, logger, http } = kernel;
  const service = new AccountService({
    users: repositories.users,
    items: repositories.items,
    claims: repositories.claims,
    notifications: repositories.notifications,
    sessions: repositories.sessions,
    itemService: deps.itemService,
    claimService: deps.claimService,
    storage,
    passwords,
    loginThrottle: deps.loginThrottle,
    emailSender,
    emails: deps.emails,
    clock,
    logger,
  });
  return {
    name: 'account',
    routes: [
      {
        path: '/account',
        router: createAccountRouter(new AccountController(service), {
          authenticate: http.authenticate,
          limiter: http.rateLimiter,
        }),
      },
    ],
  };
}
