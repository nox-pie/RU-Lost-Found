import 'dotenv/config';
import { loadEnv } from './config/env';
import { buildContainer } from './container';
import { createLogger } from './core/logger/logger';
import { RedisKeyValueStore } from './infrastructure/cache/RedisKeyValueStore';
import { MongoDatabase } from './infrastructure/database/MongoDatabase';
import { createErrorReporter } from './infrastructure/observability/createErrorReporter';
import { redactUrlCredentials } from './core/security/redact';

/**
 * Runs only the background worker (no HTTP server). Used when the API and the worker are deployed
 * as separate processes: set WORKER_ENABLED=false on the API and run this next to it.
 */
async function main(): Promise<void> {
  const env = loadEnv();
  const logger = createLogger(env);
  const database = await MongoDatabase.connect(env.MONGODB_URI, logger);
  const redis = env.REDIS_URL ? await RedisKeyValueStore.connect(env.REDIS_URL, logger) : undefined;
  const errorReporter = createErrorReporter(env);
  const container = await buildContainer(env, logger, { database, redis }, { errorReporter });

  container.worker.start();

  let stopping = false;
  const stop = async (signal: string) => {
    if (stopping) return;
    stopping = true;
    logger.info({ signal }, 'Stopping worker');
    await container.worker.stop();
    await Promise.all([database.disconnect(), redis?.disconnect()]);
    await errorReporter.flush(2000);
    process.exit(0);
  };
  process.on('SIGTERM', () => void stop('SIGTERM'));
  process.on('SIGINT', () => void stop('SIGINT'));
}

main().catch((err: unknown) => {
  process.stderr.write(
    `Failed to start worker: ${redactUrlCredentials(err instanceof Error ? err.message : String(err))}\n`,
  );
  process.exit(1);
});
