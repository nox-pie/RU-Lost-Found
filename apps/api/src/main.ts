import 'dotenv/config';
import type { Server } from 'node:http';
import { createApp } from './app';
import { loadEnv, type Env } from './config/env';
import { buildContainer } from './container';
import { createLogger, type Logger } from './core/logger/logger';
import type { ErrorReporter } from './core/observability/ErrorReporter';
import { redactUrlCredentials } from './core/security/redact';
import { RedisKeyValueStore } from './infrastructure/cache/RedisKeyValueStore';
import { MongoDatabase } from './infrastructure/database/MongoDatabase';
import { createErrorReporter } from './infrastructure/observability/createErrorReporter';

const SHUTDOWN_TIMEOUT_MS = 10_000;

/**
 * On SIGTERM (sent by the host on every deploy) or SIGINT: stop accepting connections,
 * let in-flight requests finish, then close external connections. Forces exit if that takes too long.
 */
function registerGracefulShutdown(
  server: Server,
  logger: Logger,
  reporter: ErrorReporter,
  cleanup: () => Promise<void>,
) {
  let shuttingDown = false;

  const shutdown = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, 'Shutting down');

    const forceExit = setTimeout(() => {
      logger.error('Shutdown timed out, forcing exit');
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);
    forceExit.unref();

    server.close(async () => {
      try {
        await cleanup();
        await reporter.flush(2000);
        logger.info('Shutdown complete');
        process.exit(0);
      } catch (err) {
        logger.error({ err }, 'Error during shutdown');
        process.exit(1);
      }
    });
    server.closeIdleConnections();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('unhandledRejection', (reason) => {
    logger.fatal({ err: reason }, 'Unhandled promise rejection');
    reporter.capture(reason, { area: 'process' });
    shutdown('unhandledRejection');
  });
}

async function main(): Promise<void> {
  const env = loadEnv();
  const logger = createLogger(env);
  const errorReporter = createErrorReporter(env);

  try {
    await start(env, logger, errorReporter);
  } catch (err) {
    errorReporter.capture(err, { area: 'startup' });
    await errorReporter.flush(2000);
    throw err;
  }
}

async function start(env: Env, logger: Logger, errorReporter: ErrorReporter): Promise<void> {
  const database = await MongoDatabase.connect(env.MONGODB_URI, logger);
  const redis = env.REDIS_URL ? await RedisKeyValueStore.connect(env.REDIS_URL, logger) : undefined;
  const container = await buildContainer(env, logger, { database, redis }, { errorReporter });
  // Not fatal: the API is useful without it, and the admin can be appointed by hand.
  await container.services.adminAccounts.ensure().catch((err: unknown) => {
    logger.error({ err }, 'Could not appoint the admins from ADMIN_EMAILS');
  });
  const app = createApp(container);

  const server = app.listen(env.PORT, (error?: Error) => {
    if (error) throw error;
    logger.info({ port: env.PORT, env: env.NODE_ENV }, 'API listening');
  });
  // Keep idle connections open longer than the hosting load balancer does (avoids random 502s),
  // and give slow mobile uploads time to finish, but not forever (slow-loris protection).
  server.keepAliveTimeout = 65_000;
  server.headersTimeout = 66_000;
  server.requestTimeout = 120_000;

  if (env.WORKER_ENABLED) container.worker.start();

  registerGracefulShutdown(server, logger, errorReporter, async () => {
    await container.worker.stop();
    await Promise.all([database.disconnect(), redis?.disconnect()]);
  });
}

main().catch((err: unknown) => {
  process.stderr.write(
    `Failed to start API: ${redactUrlCredentials(err instanceof Error ? err.message : String(err))}\n`,
  );
  process.exit(1);
});
