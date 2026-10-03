import 'dotenv/config';
import { loadEnv } from '../config/env';
import { buildContainer } from '../container';
import { createLogger } from '../core/logger/logger';
import { redactUrlCredentials } from '../core/security/redact';
import { MongoDatabase } from '../infrastructure/database/MongoDatabase';

/**
 * The sample data visitors see (docs/demo-data.md):
 *
 *   npm run demo -- seed     # create it (skipped if it already exists)
 *   npm run demo -- reset    # back to the original sample data
 *   npm run demo -- remove   # delete it all (also set DEMO_MODE=false on the API)
 *
 * Its events are delivered by the API's background worker, which fills notifications and the
 * activity log within seconds.
 */
async function run(command: string | undefined): Promise<void> {
  if (!command || !['seed', 'reset', 'remove'].includes(command)) {
    throw new Error('Usage: npm run demo -- <seed|reset|remove>');
  }
  const env = loadEnv();
  const logger = createLogger(env);
  const database = await MongoDatabase.connect(env.MONGODB_URI, logger);
  try {
    const { services } = await buildContainer(env, logger, { database });
    const result =
      command === 'seed'
        ? ((await services.demo.seed()) ?? 'already there')
        : command === 'reset'
          ? await services.demo.reset()
          : await services.demo.remove();
    process.stdout.write(`${command}: ${JSON.stringify(result)}\n`);
  } finally {
    await database.disconnect();
  }
}

run(process.argv[2]).catch((err: unknown) => {
  process.stderr.write(
    `Demo command failed: ${redactUrlCredentials(err instanceof Error ? err.message : String(err))}\n`,
  );
  process.exit(1);
});
