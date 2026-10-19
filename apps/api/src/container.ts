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
import type { StorageProvider } from './core/storage/StorageProvider';
import { FallbackKeyValueStore } from './infrastructure/cache/FallbackKeyValueStore';
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
import type { AppModule } from './core/modules/AppModule';
import { createAccountModule } from './modules/account/account.module';
import { createAdminModule } from './modules/admin/admin.module';
import { createAuditModule } from './modules/audit/audit.module';
import { MongoAuditTrail } from './modules/audit/MongoAuditTrail';
import { createAuthModule } from './modules/auth/auth.module';
import { MongoSessionRepository } from './modules/auth/infrastructure/MongoSessionRepository';
import type { ClaimService } from './modules/claims/claim.service';
import { createClaimsModule } from './modules/claims/claims.module';
import { MongoClaimRepository } from './modules/claims/infrastructure/MongoClaimRepository';
import { createDemoModule } from './modules/demo/demo.module';
import type { DemoSeeder } from './modules/demo/DemoSeeder';
import { createDeskModule } from './modules/desk/desk.module';
import { createHealthModule } from './modules/health/health.module';
import { MongoItemRepository } from './modules/items/infrastructure/MongoItemRepository';
import type { ItemService } from './modules/items/item.service';
import { createItemsModule } from './modules/items/items.module';
import type { Kernel } from './modules/kernel';
import { MongoModerationReportRepository } from './modules/moderation/infrastructure/MongoModerationReportRepository';
import { createModerationModule } from './modules/moderation/moderation.module';
import { MongoNotificationRepository } from './modules/notifications/infrastructure/MongoNotificationRepository';
import { createNotificationsModule } from './modules/notifications/notifications.module';
import { MongoUniversityRepository } from './modules/universities/infrastructure/MongoUniversityRepository';
import { createUniversitiesModule } from './modules/universities/universities.module';
import type { AdminAccounts } from './modules/users/AdminAccounts';
import { MongoUserRepository } from './modules/users/infrastructure/MongoUserRepository';
import { createUsersModule } from './modules/users/users.module';

/**
 * Everything the HTTP layer needs, fully wired.
 * `createApp` depends only on this shape.
 */
export interface Container {
  env: Env;
  logger: Logger;
  /** The business modules, in the order their routes are mounted. */
  modules: readonly AppModule[];
  /** For the general per-IP cap on writes, which app.ts applies in front of every module. */
  rateLimiter: RateLimiter;
  /** Application services used outside HTTP requests (scripts, start-up, tests). */
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
  const { clock, ids, passwordHasher, errorReporter } = providers;
  // If Redis becomes unreachable, codes, rate limits and job leases fall back to this process's
  // memory instead of failing every sign-in and change (see FallbackKeyValueStore).
  const keyValueStore =
    infra.redis && providers.keyValueStore === infra.redis
      ? new FallbackKeyValueStore(
          infra.redis,
          new InMemoryKeyValueStore(clock),
          clock,
          logger,
          errorReporter,
        )
      : providers.keyValueStore;
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
  const currentAccount = (userId: string) => repositories.users.findById(userId);

  const kernel: Kernel = {
    env,
    logger,
    clock,
    ids,
    connection,
    unitOfWork,
    repositories,
    audit,
    keyValueStore,
    storage,
    emailSender,
    emailLayout: new EmailLayout({
      name: env.BRAND_NAME,
      primaryColor: env.BRAND_PRIMARY_COLOR,
      backgroundColor: env.BRAND_BACKGROUND_COLOR,
    }),
    passwords: passwordHasher,
    tokens,
    http: {
      authenticate: authenticate(tokens),
      rateLimiter,
      uploadSlot: limitConcurrency(4),
      requireAdmin: authorizeCurrent(currentAccount, 'UNIVERSITY_ADMIN', 'PLATFORM_ADMIN'),
      requireStaff: authorizeCurrent(
        currentAccount,
        'SECURITY_DESK',
        'UNIVERSITY_ADMIN',
        'PLATFORM_ADMIN',
      ),
    },
  };

  // Business modules. A module receives the kernel plus the services of other modules it
  // names explicitly, so the dependencies between modules are visible here.
  const users = createUsersModule(kernel);
  const notifications = createNotificationsModule(kernel);
  const auth = createAuthModule(kernel, { adminAccounts: users.adminAccounts });
  const items = createItemsModule(kernel);
  const claims = createClaimsModule(kernel);
  const moderation = createModerationModule(kernel);
  const demo = createDemoModule(kernel);
  const modules: AppModule[] = [
    createHealthModule(providers.healthIndicators),
    auth.module,
    users.module,
    createAccountModule(kernel, {
      itemService: items.service,
      claimService: claims.service,
      loginThrottle: auth.loginThrottle,
      emails: notifications.emails,
    }),
    items.module,
    notifications.module,
    createUniversitiesModule(kernel),
    claims.module,
    moderation.module,
    createAdminModule(kernel, {
      sessions: auth.sessions,
      itemService: items.service,
      moderation: moderation.controller,
      auditLog: audit,
    }),
    createDeskModule(kernel, { claimService: claims.service, itemService: items.service }),
    createAuditModule(audit),
    demo.module,
  ];

  // Background work: every module's event handlers (Observer) and scheduled jobs
  const scheduler = new JobScheduler(
    [
      ...modules.flatMap((module) => module.jobs ?? []),
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
  const handlers = new EventHandlerRegistry(modules.flatMap((module) => module.handlers ?? []));
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
    modules,
    rateLimiter,
    services: {
      adminAccounts: users.adminAccounts,
      demo: demo.seeder,
      claims: claims.service,
      items: items.service,
      audit,
    },
    errorReporter,
    worker,
    localUploads: providers.storage instanceof LocalDiskStorageProvider ? LOCAL_UPLOADS : undefined,
  };
}
