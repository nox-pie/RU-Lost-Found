import type { Server } from 'node:http';
import type { Connection } from 'mongoose';
import { afterEach, beforeAll } from 'vitest';
import { createApp } from '../app';
import { loadEnv, type Env } from '../config/env';
import { buildContainer, type Container } from '../container';
import type { EmailMessage, EmailSender } from '../core/email/EmailSender';
import type { HealthIndicator } from '../core/health/HealthIndicator';
import { createLogger } from '../core/logger/logger';
import { InMemoryKeyValueStore } from '../infrastructure/cache/InMemoryKeyValueStore';
import { MongoDatabase } from '../infrastructure/database/MongoDatabase';
import { MongoUniversityRepository } from '../modules/universities/infrastructure/MongoUniversityRepository';
import { FixedClock, T0, aUniversity } from './builders';
import { InMemoryStorageProvider } from './InMemoryStorageProvider';
import { serve } from './http';
import { useTestDatabase } from './testDatabase';

function testEnv(overrides: Record<string, string> = {}): Env {
  return loadEnv({
    NODE_ENV: 'test',
    MONGODB_URI: 'mongodb://127.0.0.1:27017/unused-in-tests',
    APP_SECRET: 'test-secret-that-is-at-least-32-characters-long',
    BCRYPT_ROUNDS: '4',
    ...overrides,
  });
}

/** Keeps every email instead of sending it, so tests can read codes out of them. */
export class CapturingEmailSender implements EmailSender {
  readonly sent: EmailMessage[] = [];

  async send(message: EmailMessage): Promise<void> {
    this.sent.push(message);
  }

  to(address: string): EmailMessage[] {
    return this.sent.filter((message) => message.to === address.toLowerCase());
  }

  /** The 6-digit code in the latest email to `address`. */
  codeFor(address: string): string {
    const code = /\b(\d{6})\b/.exec(this.to(address).at(-1)?.text ?? '')?.[1];
    if (!code) throw new Error(`No code was emailed to ${address}`);
    return code;
  }

  clear(): void {
    this.sent.length = 0;
  }
}

/** A dependency whose health the test controls. */
export class FakeHealthIndicator implements HealthIndicator {
  constructor(
    readonly name: string,
    public healthy = true,
  ) {}

  async isHealthy(): Promise<boolean> {
    return this.healthy;
  }
}

export interface TestApp {
  /** The app behind a test server; pass it to supertest's `request()`. */
  readonly app: Server;
  readonly container: Container;
  readonly connection: Connection;
  readonly clock: FixedClock;
  readonly email: CapturingEmailSender;
  readonly store: InMemoryKeyValueStore;
  readonly storage: InMemoryStorageProvider;
}

/**
 * The real application (real composition root, repositories and MongoDB) with fakes only at the
 * edges: a fixed clock, captured emails and an in-memory key-value store. State is reset after each test.
 */
export function useTestApp(
  options: { healthIndicators?: HealthIndicator[]; env?: Record<string, string> } = {},
): TestApp {
  const db = useTestDatabase();
  const clock = new FixedClock();
  const email = new CapturingEmailSender();
  const store = new InMemoryKeyValueStore(clock);
  const storage = new InMemoryStorageProvider();
  let app: Server | undefined;
  let container: Container | undefined;

  beforeAll(async () => {
    const env = testEnv(options.env);
    const logger = createLogger(env);
    container = await buildContainer(
      env,
      logger,
      { database: MongoDatabase.fromConnection(db.connection, logger) },
      {
        clock,
        emailSender: email,
        keyValueStore: store,
        storage,
        ...(options.healthIndicators ? { healthIndicators: options.healthIndicators } : {}),
      },
    );
    app = await serve(createApp(container));
  });

  afterEach(() => {
    store.clear();
    email.clear();
    storage.reset();
    clock.set(T0);
  });

  return {
    get app() {
      if (!app) throw new Error('The test app is only available inside tests.');
      return app;
    },
    get container() {
      if (!container) throw new Error('The test app is only available inside tests.');
      return container;
    },
    get connection() {
      return db.connection;
    },
    clock,
    email,
    store,
    storage,
  };
}

/** Rishihood University with its email domain and schools, as the seed script creates it. */
export async function seedUniversity(
  connection: Connection,
  overrides: Partial<Parameters<typeof aUniversity>[0]> = {},
) {
  const university = aUniversity({
    slug: 'rishihood',
    emailDomains: ['rishihood.edu.in'],
    schools: ['Newton School of Technology', 'School of Entrepreneurship'],
    ...overrides,
  });
  await new MongoUniversityRepository(connection).create(university);
  return university;
}
