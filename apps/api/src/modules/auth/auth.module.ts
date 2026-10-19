import type { AppModule } from '../../core/modules/AppModule';
import { deriveKey } from '../../infrastructure/security/keys';
import type { Kernel } from '../kernel';
import type { AdminAccounts } from '../users/AdminAccounts';
import { AuthController } from './auth.controller';
import { AuthEmails } from './auth.emails';
import { createAuthRouter } from './auth.routes';
import { AuthService } from './auth.service';
import { LoginThrottle } from './LoginThrottle';
import { OtpService } from './OtpService';
import { SessionManager } from './SessionManager';

export function createAuthModule(kernel: Kernel, deps: { adminAccounts: AdminAccounts }) {
  const { env, repositories, keyValueStore, unitOfWork, ids, clock, logger, audit, http } = kernel;
  const loginThrottle = new LoginThrottle(keyValueStore);
  const sessions = new SessionManager(
    repositories.sessions,
    unitOfWork,
    ids,
    clock,
    logger,
    audit,
    repositories.users,
  );
  const service = new AuthService({
    users: repositories.users,
    universities: repositories.universities,
    otp: new OtpService(keyValueStore, deriveKey(env.APP_SECRET, 'one-time-code')),
    sessions,
    tokens: kernel.tokens,
    passwords: kernel.passwords,
    email: kernel.emailSender,
    emails: new AuthEmails(kernel.emailLayout),
    adminAccounts: deps.adminAccounts,
    ids,
    clock,
    audit,
    loginThrottle,
    logger,
    demoSignIn: env.DEMO_MODE,
  });
  const controller = new AuthController(service, {
    secureCookies: env.NODE_ENV === 'production',
  });
  const module: AppModule = {
    name: 'auth',
    routes: [
      {
        path: '/auth',
        router: createAuthRouter(controller, http.rateLimiter, env.CORS_ORIGINS, http.authenticate),
      },
    ],
  };
  return { module, sessions, loginThrottle };
}
