import type { RequestHandler } from 'express';
import type { Connection } from 'mongoose';
import type { Env } from '../config/env';
import type { AuditTrail } from '../core/audit/AuditTrail';
import type { KeyValueStore } from '../core/cache/KeyValueStore';
import type { Clock } from '../core/domain/Clock';
import type { IdGenerator } from '../core/domain/IdGenerator';
import type { EmailLayout } from '../core/email/EmailLayout';
import type { EmailSender } from '../core/email/EmailSender';
import type { RateLimiter } from '../core/http/rateLimit';
import type { Logger } from '../core/logger/logger';
import type { UnitOfWork } from '../core/persistence/UnitOfWork';
import type { PasswordHasher } from '../core/security/PasswordHasher';
import type { TokenService } from '../core/security/TokenService';
import type { StorageProvider } from '../core/storage/StorageProvider';
import type { SessionRepository } from './auth/domain/SessionRepository';
import type { ClaimRepository } from './claims/domain/ClaimRepository';
import type { ItemRepository } from './items/domain/ItemRepository';
import type { ModerationReportRepository } from './moderation/domain/ModerationReportRepository';
import type { NotificationRepository } from './notifications/domain/NotificationRepository';
import type { UniversityRepository } from './universities/domain/UniversityRepository';
import type { UserRepository } from './users/domain/UserRepository';

/** Every repository, as the interfaces the modules depend on. */
export interface Repositories {
  universities: UniversityRepository;
  users: UserRepository;
  items: ItemRepository;
  claims: ClaimRepository;
  sessions: SessionRepository;
  notifications: NotificationRepository;
  reports: ModerationReportRepository;
}

/**
 * What every module may use, built once by the composition root (container.ts): settings,
 * cross-cutting providers, the repositories and the shared HTTP middleware. A module's
 * `*.module.ts` builds its services, controllers, routes, handlers and jobs from this, plus the
 * services of other modules it names explicitly as parameters.
 */
export interface Kernel {
  env: Env;
  logger: Logger;
  clock: Clock;
  ids: IdGenerator;
  /** Some read models and stores query MongoDB directly (admin statistics, demo data). */
  connection: Connection;
  unitOfWork: UnitOfWork;
  repositories: Repositories;
  audit: AuditTrail;
  keyValueStore: KeyValueStore;
  storage: StorageProvider;
  emailSender: EmailSender;
  emailLayout: EmailLayout;
  passwords: PasswordHasher;
  tokens: TokenService;
  http: {
    authenticate: RequestHandler;
    rateLimiter: RateLimiter;
    /** Shared by every upload route: at most a few uploads are processed at once. */
    uploadSlot: RequestHandler;
    /** Admin routes: checks the role stored now, not the one in the token. */
    requireAdmin: RequestHandler;
    /** Security desk console: desk staff and admins, by the role stored now. */
    requireStaff: RequestHandler;
  };
}
