import type { RequestHandler } from 'express';
import type { Env } from './config/env';
import type { KeyValueStore } from './core/cache/KeyValueStore';
import { type Clock, SystemClock } from './core/domain/Clock';
import type { IdGenerator } from './core/domain/IdGenerator';
import { EmailLayout } from './core/email/EmailLayout';
import type { EmailSender } from './core/email/EmailSender';
import { EventHandlerRegistry } from './core/events/EventHandler';
import type { HealthIndicator } from './core/health/HealthIndicator';
import { authenticate, authorizeCurrent } from './core/http/auth';
import { limitConcurrency } from './core/http/middleware/concurrencyLimit';
import { RateLimiter } from './core/http/rateLimit';
import type { Logger } from './core/logger/logger';
import type { ErrorReporter } from './core/observability/ErrorReporter';
import type { PasswordHasher } from './core/security/PasswordHasher';
import { generateNumericCode } from './core/security/randomCode';
import type { StorageProvider } from './core/storage/StorageProvider';
import { InMemoryKeyValueStore } from './infrastructure/cache/InMemoryKeyValueStore';
import type { RedisKeyValueStore } from './infrastructure/cache/RedisKeyValueStore';
import type { MongoDatabase } from './infrastructure/database/MongoDatabase';
import { MongoUnitOfWork } from './infrastructure/database/MongoUnitOfWork';
import { ObjectIdGenerator } from './infrastructure/database/objectIds';
import { BrevoEmailSender } from './infrastructure/email/BrevoEmailSender';
import { ConsoleEmailSender } from './infrastructure/email/ConsoleEmailSender';
import { FileEmailSender } from './infrastructure/email/FileEmailSender';
import { SkipUndeliverableEmailSender } from './infrastructure/email/SkipUndeliverableEmailSender';
import { createErrorReporter } from './infrastructure/observability/createErrorReporter';
import { MongoOutbox } from './infrastructure/outbox/MongoOutbox';
import { OutboxProcessor } from './infrastructure/outbox/OutboxProcessor';
import { BcryptPasswordHasher } from './infrastructure/security/BcryptPasswordHasher';
import { JwtTokenService } from './infrastructure/security/JwtTokenService';
import { deriveKey } from './infrastructure/security/keys';
import { CloudinaryStorageProvider } from './infrastructure/storage/CloudinaryStorageProvider';
import { LocalDiskStorageProvider } from './infrastructure/storage/LocalDiskStorageProvider';
import { SanitizingStorageProvider } from './infrastructure/storage/SanitizingStorageProvider';
import { SharpImageProcessor } from './infrastructure/storage/SharpImageProcessor';
import { BackgroundWorker } from './infrastructure/worker/BackgroundWorker';
import { JobScheduler } from './infrastructure/worker/JobScheduler';
import { AdminDashboardService } from './modules/admin/admin-dashboard.service';
import { AdminController } from './modules/admin/admin.controller';
import { MongoStatsReader } from './modules/admin/infrastructure/MongoStatsReader';
import { UserAdminService } from './modules/admin/user-admin.service';
import { AuditEventHandler } from './modules/audit/AuditEventHandler';
import { MongoAuditTrail } from './modules/audit/MongoAuditTrail';
import { AuthController } from './modules/auth/auth.controller';
import { AuthEmails } from './modules/auth/auth.emails';
import { AuthService } from './modules/auth/auth.service';
import { MongoSessionRepository } from './modules/auth/infrastructure/MongoSessionRepository';
import { LoginThrottle } from './modules/auth/LoginThrottle';
import { OtpService } from './modules/auth/OtpService';
import { SessionManager } from './modules/auth/SessionManager';
import { ClaimController } from './modules/claims/claim.controller';
import { ClaimService } from './modules/claims/claim.service';
import { CloseClaimsOnItemRemoved } from './modules/claims/handlers/CloseClaimsOnItemRemoved';
import { MongoClaimRepository } from './modules/claims/infrastructure/MongoClaimRepository';
import { DemoClock } from './modules/demo/DemoClock';
import { DemoSeeder } from './modules/demo/DemoSeeder';
import { MongoDemoDataStore } from './modules/demo/infrastructure/MongoDemoDataStore';
import { HealthController } from './modules/health/health.controller';
import { HealthService } from './modules/health/health.service';
import { MongoItemRepository } from './modules/items/infrastructure/MongoItemRepository';
import { ItemController } from './modules/items/item.controller';
import { ItemService } from './modules/items/item.service';
import { MongoModerationReportRepository } from './modules/moderation/infrastructure/MongoModerationReportRepository';
import { ModerationController } from './modules/moderation/moderation.controller';
import { ModerationService } from './modules/moderation/moderation.service';
import { AccountSecurityHandler } from './modules/notifications/handlers/AccountSecurityHandler';
import { ClaimNotificationHandler } from './modules/notifications/handlers/ClaimNotificationHandler';
import { ItemModerationHandler } from './modules/notifications/handlers/ItemModerationHandler';
import { MongoNotificationRepository } from './modules/notifications/infrastructure/MongoNotificationRepository';
import { NotificationController } from './modules/notifications/notification.controller';
import { NotificationEmails } from './modules/notifications/notification.emails';
import { NotificationService } from './modules/notifications/notification.service';
import { MongoUniversityRepository } from './modules/universities/infrastructure/MongoUniversityRepository';
import { UniversityController } from './modules/universities/university.controller';
import { AdminAccounts } from './modules/users/AdminAccounts';
import { MongoUserRepository } from './modules/users/infrastructure/MongoUserRepository';
import { UserController } from './modules/users/user.controller';
import { UserService } from './modules/users/user.service';

/**
 * Everything the HTTP layer needs, fully wired.
 * `createApp` depends only on this shape.
 */
export interface Container {
  env: Env;
  logger: Logger;
  middleware: {
    authenticate: RequestHandler;
    rateLimiter: RateLimiter;
    /** Shared by every upload route: at most a few uploads are processed at once. */
    uploadSlot: RequestHandler;
    /** Admin routes: checks the role stored now, not the one in the token. */
    requireAdmin: RequestHandler;
  };
  controllers: {
    health: HealthController;
    auth: AuthController;
    users: UserController;
    items: ItemController;
    claims: ClaimController;
    notifications: NotificationController;
    universities: UniversityController;
    moderation: ModerationController;
    admin: AdminController;
  };
  /** Application services used outside HTTP requests (scheduled jobs, event handlers). */
  services: {
    adminAccounts: AdminAccounts;
    claims: ClaimService;
    demo: DemoSeeder;
    items: ItemService;
    audit: MongoAuditTrail;
  };
  /** Sends unexpected errors to error tracking (Sentry), when configured. */
  errorReporter: ErrorReporter;
  /** Delivers outbox events and runs scheduled jobs; started by main.ts or worker.ts. */
  worker: BackgroundWorker;
  /** Set when images are stored on local disk and must be served by the API itself. */
  localUploads?: { directory: string; publicPath: string };
}

/** Infrastructure that must be connected before the object graph is built. */
export interface Infrastructure {
  database: MongoDatabase;
  redis?: RedisKeyValueStore;
}

/** Cross-cutting providers. Tests replace them with fakes (fixed clock, captured emails, ...). */
export interface Providers {
  clock: Clock;
  ids: IdGenerator;
  keyValueStore: KeyValueStore;
  emailSender: EmailSender;
  passwordHasher: PasswordHasher;
  storage: StorageProvider;
  healthIndicators: HealthIndicator[];
  errorReporter: ErrorReporter;
}

/** Where images are kept when Cloudinary is not configured (development only). */
const LOCAL_UPLOADS = { directory: '.uploads', publicPath: '/api/v1/uploads' };

function defaultProviders(
  env: Env,
  logger: Logger,
  infra: Infrastructure,
): Omit<Providers, 'errorReporter'> {
  const clock = new SystemClock();

  if (!infra.redis && env.NODE_ENV === 'production') {
    logger.warn('REDIS_URL is not set: codes and rate limits are kept in memory on this instance');
  }

  return {
    clock,
    ids: new ObjectIdGenerator(),
    keyValueStore: infra.redis ?? new InMemoryKeyValueStore(clock),
    emailSender: env.BREVO_API_KEY
      ? new BrevoEmailSender(env.BREVO_API_KEY, {
          address: env.EMAIL_FROM_ADDRESS,
          name: env.EMAIL_FROM_NAME ?? env.BRAND_NAME,
        })
      : env.DEV_EMAIL_DIR
        ? new FileEmailSender(env.DEV_EMAIL_DIR)
        : new ConsoleEmailSender(logger),
    passwordHasher: new BcryptPasswordHasher(env.BCRYPT_ROUNDS),
    storage:
      env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET
        ? new CloudinaryStorageProvider({
            cloudName: env.CLOUDINARY_CLOUD_NAME,
            apiKey: env.CLOUDINARY_API_KEY,
            apiSecret: env.CLOUDINARY_API_SECRET,
          })
        : new LocalDiskStorageProvider(LOCAL_UPLOADS.directory, LOCAL_UPLOADS.publicPath),
    healthIndicators: infra.redis ? [infra.database, infra.redis] : [infra.database],
  };
}

/**
 * Composition root: the only place that chooses concrete implementations and passes them
 * into constructors. Swapping a provider (another email service, another database) is a
 * change here and nowhere else.
 */
export async function buildContainer(
  env: Env,
  logger: Logger,
  infra: Infrastructure,
  overrides: Partial<Providers> = {},
): Promise<Container> {
  const { connection } = infra.database;
  const providers: Providers = {
    ...defaultProviders(env, logger, infra),
    // Created only when not supplied: main.ts sets it up first, to report startup failures too.
    errorReporter: overrides.errorReporter ?? createErrorReporter(env),
    ...overrides,
  };
  const { clock, ids, keyValueStore, passwordHasher, errorReporter } = providers;
  // Mail to reserved test domains (demo accounts) is never handed to the provider.
  const emailSender = new SkipUndeliverableEmailSender(providers.emailSender, logger);
  // Every image is cleaned (metadata removed, resized, re-encoded) before any provider stores it.
  const storage = new SanitizingStorageProvider(providers.storage, new SharpImageProcessor());

  // Persistence. Repositories of aggregates that record domain events share the outbox.
  const unitOfWork = new MongoUnitOfWork(connection);
  const outbox = new MongoOutbox(connection);
  const audit = new MongoAuditTrail(connection, logger);
  const repositories = {
    universities: new MongoUniversityRepository(connection),
    users: new MongoUserRepository(connection, outbox),
    items: new MongoItemRepository(connection, outbox),
    claims: new MongoClaimRepository(connection, outbox),
    sessions: new MongoSessionRepository(connection),
    notifications: new MongoNotificationRepository(connection),
    reports: new MongoModerationReportRepository(connection, outbox),
  };
  await Promise.all([
    outbox.ensureIndexes(),
    audit.ensureIndexes(),
    ...Object.values(repositories).map((repository) => repository.ensureIndexes()),
  ]);
  logger.info('Database indexes are up to date');

  // Security
  const tokens = new JwtTokenService(
    {
      access: deriveKey(env.APP_SECRET, 'access-token'),
      verification: deriveKey(env.APP_SECRET, 'verification-token'),
    },
    clock,
  );
  const rateLimiter = new RateLimiter(keyValueStore);

  // Auth
  const emailLayout = new EmailLayout({
    name: env.BRAND_NAME,
    primaryColor: env.BRAND_PRIMARY_COLOR,
    backgroundColor: env.BRAND_BACKGROUND_COLOR,
  });
  const notificationEmails = new NotificationEmails(emailLayout, env.APP_URL);

  const adminAccounts = new AdminAccounts(env.ADMIN_EMAILS, repositories.users, clock, logger);
  const sessions = new SessionManager(repositories.sessions, unitOfWork, ids, clock, logger, audit);
  const authService = new AuthService({
    users: repositories.users,
    universities: repositories.universities,
    otp: new OtpService(keyValueStore, deriveKey(env.APP_SECRET, 'one-time-code')),
    sessions,
    tokens,
    passwords: passwordHasher,
    email: emailSender,
    emails: new AuthEmails(emailLayout),
    adminAccounts,
    ids,
    clock,
    audit,
    loginThrottle: new LoginThrottle(keyValueStore),
    logger,
    demoSignIn: env.DEMO_MODE,
  });

  // Users
  const userService = new UserService(
    repositories.users,
    repositories.universities,
    storage,
    clock,
    logger,
  );

  // Items
  const itemService = new ItemService(
    repositories.items,
    repositories.users,
    storage,
    ids,
    clock,
    logger,
  );

  // Claims
  const claimService = new ClaimService({
    claims: repositories.claims,
    items: repositories.items,
    users: repositories.users,
    unitOfWork,
    ids,
    clock,
    generateHandoverCode: () => generateNumericCode(6),
    logger,
    audit,
  });

  // Sample data: claims are played through a ClaimService on its own clock, so the demo
  // history is dated over past weeks.
  const demoClock = new DemoClock();
  const demo = new DemoSeeder({
    universities: repositories.universities,
    users: repositories.users,
    items: repositories.items,
    claims: new ClaimService({
      claims: repositories.claims,
      items: repositories.items,
      users: repositories.users,
      unitOfWork,
      ids,
      clock: demoClock,
      generateHandoverCode: () => generateNumericCode(6),
      logger,
      audit,
    }),
    clock: demoClock,
    store: new MongoDemoDataStore(connection),
    storage,
    passwords: passwordHasher,
    ids,
    logger,
    universitySlug: 'rishihood',
  });

  // Moderation and administration
  const moderationService = new ModerationService({
    reports: repositories.reports,
    items: repositories.items,
    users: repositories.users,
    unitOfWork,
    ids,
    clock,
  });
  const adminController = new AdminController(
    new UserAdminService(repositories.users, sessions, clock),
    new AdminDashboardService(new MongoStatsReader(connection), audit, repositories.users, clock),
    itemService,
  );

  // Notifications
  const notificationService = new NotificationService(
    repositories.notifications,
    repositories.users,
    emailSender,
    ids,
    clock,
  );

  // Background work: event handlers (Observer) and scheduled jobs
  const handlers = new EventHandlerRegistry([
    new ClaimNotificationHandler(
      notificationService,
      repositories.claims,
      repositories.items,
      repositories.users,
      notificationEmails,
    ),
    new AccountSecurityHandler(repositories.users, emailSender, notificationEmails),
    new ItemModerationHandler(notificationService, repositories.items, notificationEmails),
    new CloseClaimsOnItemRemoved(claimService),
    new AuditEventHandler(audit),
  ]);
  const scheduler = new JobScheduler(
    [
      { name: 'expire-claims', intervalSeconds: 5 * 60, run: () => claimService.expireOverdue() },
      {
        name: 'purge-removed-item-photos',
        intervalSeconds: 60 * 60,
        run: () => itemService.purgeRemovedPhotos(30),
      },
      ...(env.DEMO_MODE
        ? [
            {
              name: 'reset-demo-data',
              intervalSeconds: 24 * 60 * 60,
              run: () => demo.reset(clock.now()),
            },
          ]
        : []),
      {
        name: 'prune-outbox',
        intervalSeconds: 24 * 60 * 60,
        run: () =>
          outbox.deleteDoneBefore(new Date(clock.now().getTime() - 7 * 24 * 60 * 60 * 1000)),
      },
    ],
    keyValueStore,
    logger,
    errorReporter,
  );
  const worker = new BackgroundWorker(
    new OutboxProcessor(outbox, handlers, clock, logger, errorReporter),
    scheduler,
    logger,
    2000,
    errorReporter,
  );

  return {
    env,
    logger,
    middleware: {
      authenticate: authenticate(tokens),
      rateLimiter,
      uploadSlot: limitConcurrency(4),
      requireAdmin: authorizeCurrent(
        (userId) => repositories.users.findById(userId),
        'UNIVERSITY_ADMIN',
        'PLATFORM_ADMIN',
      ),
    },
    controllers: {
      health: new HealthController(new HealthService(providers.healthIndicators)),
      auth: new AuthController(authService, { secureCookies: env.NODE_ENV === 'production' }),
      users: new UserController(userService),
      items: new ItemController(itemService),
      claims: new ClaimController(claimService),
      notifications: new NotificationController(notificationService),
      universities: new UniversityController(repositories.universities),
      moderation: new ModerationController(moderationService),
      admin: adminController,
    },
    services: {
      adminAccounts,
      demo,
      claims: claimService,
      items: itemService,
      audit,
    },
    errorReporter,
    worker,
    localUploads: providers.storage instanceof LocalDiskStorageProvider ? LOCAL_UPLOADS : undefined,
  };
}
