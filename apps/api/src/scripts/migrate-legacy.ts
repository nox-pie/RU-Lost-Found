import 'dotenv/config';
import { loadEnv } from '../config/env';
import { createLogger } from '../core/logger/logger';
import { MongoDatabase } from '../infrastructure/database/MongoDatabase';
import { MongoItemRepository } from '../modules/items/infrastructure/MongoItemRepository';
import { MongoUniversityRepository } from '../modules/universities/infrastructure/MongoUniversityRepository';
import { MongoUserRepository } from '../modules/users/infrastructure/MongoUserRepository';
import { LegacyMigration } from './legacy/LegacyMigration';

/**
 * Moves the first version's accounts and items into this database.
 *
 *   LEGACY_MONGODB_URI=<old database> npm run migrate-legacy              # dry run: report only
 *   LEGACY_MONGODB_URI=<old database> npm run migrate-legacy -- --apply   # write
 *
 * Options: --university=<slug> (default: rishihood). The old database is only read.
 * Run `npm run seed` first so the university exists.
 */
async function migrate(args: string[]): Promise<void> {
  const env = loadEnv();
  const logger = createLogger(env);
  const legacyUri = process.env.LEGACY_MONGODB_URI?.trim();
  if (!legacyUri) throw new Error('Set LEGACY_MONGODB_URI to the old database.');
  if (legacyUri === env.MONGODB_URI) {
    throw new Error('LEGACY_MONGODB_URI and MONGODB_URI point at the same database.');
  }
  const slug = args.find((arg) => arg.startsWith('--university='))?.split('=')[1] ?? 'rishihood';
  const apply = args.includes('--apply');

  const legacy = await MongoDatabase.connect(legacyUri, logger);
  const target = await MongoDatabase.connect(env.MONGODB_URI, logger);
  try {
    const university = await new MongoUniversityRepository(target.connection).findBySlug(slug);
    if (!university) throw new Error(`No university "${slug}". Run npm run seed first.`);
    const users = new MongoUserRepository(target.connection);
    const items = new MongoItemRepository(target.connection);
    await Promise.all([users.ensureIndexes(), items.ensureIndexes()]);

    const report = await new LegacyMigration(
      legacy.connection,
      { users, items },
      university,
      logger,
    ).run({ apply });
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    if (!apply) process.stdout.write('Dry run: nothing was written. Add --apply to migrate.\n');
  } finally {
    await Promise.all([legacy.disconnect(), target.disconnect()]);
  }
}

migrate(process.argv.slice(2)).catch((err: unknown) => {
  process.stderr.write(`Migration failed: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
