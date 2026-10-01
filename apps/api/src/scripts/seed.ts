import 'dotenv/config';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { loadEnv } from '../config/env';
import { SystemClock } from '../core/domain/Clock';
import { createLogger } from '../core/logger/logger';
import { MongoDatabase } from '../infrastructure/database/MongoDatabase';
import { ObjectIdGenerator } from '../infrastructure/database/objectIds';
import { University } from '../modules/universities/domain/University';
import { MongoUniversityRepository } from '../modules/universities/infrastructure/MongoUniversityRepository';

/**
 * The universities a deployment starts with live in a JSON file, not in code, so another
 * organisation sets up its own deployment by editing data only.
 *
 *   npm run seed                          # seed/universities.json
 *   npm run seed -- path/to/other.json
 */
const DEFAULT_FILE = 'seed/universities.json';

const seedFileSchema = z
  .array(
    z.object({
      name: z.string().trim().min(2),
      slug: z.string().regex(/^[a-z0-9-]{2,40}$/, 'use lowercase letters, digits and dashes'),
      emailDomains: z.array(z.string()).min(1),
      schools: z.array(z.string().trim().min(2)).min(1),
    }),
  )
  .min(1);

function readSeedFile(file: string) {
  const parsed = seedFileSchema.safeParse(JSON.parse(readFileSync(file, 'utf8')));
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
    throw new Error(`${file} is invalid:\n  ${problems.join('\n  ')}`);
  }
  return parsed.data;
}

/** Creates the starting data if it is missing. Safe to run any number of times. */
async function seed(): Promise<void> {
  const file = path.resolve(process.argv[2] ?? DEFAULT_FILE);
  const universitiesToSeed = readSeedFile(file);
  const env = loadEnv();
  const logger = createLogger(env);
  const database = await MongoDatabase.connect(env.MONGODB_URI, logger);
  const universities = new MongoUniversityRepository(database.connection);
  const ids = new ObjectIdGenerator();
  const clock = new SystemClock();

  try {
    await universities.ensureIndexes();
    for (const data of universitiesToSeed) {
      if (await universities.findBySlug(data.slug)) {
        logger.info({ slug: data.slug }, 'University already exists, skipping');
        continue;
      }
      await universities.create(University.create({ id: ids.next(), ...data, now: clock.now() }));
      logger.info({ slug: data.slug }, 'Created university');
    }
  } finally {
    await database.disconnect();
  }
}

seed().catch((err: unknown) => {
  process.stderr.write(`Seeding failed: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
