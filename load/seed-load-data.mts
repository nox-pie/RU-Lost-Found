/**
 * Test data for the load test: accounts and posts written straight into the database (signing
 * up 300 people through emailed codes would test the email queue, not the API).
 *
 *   MONGODB_URI='mongodb://127.0.0.1:27018/ru-lost-found-v2?directConnection=true' \
 *     npx tsx load/seed-load-data.mts
 */
import bcrypt from 'bcrypt';
import { ITEM_CATEGORIES } from '@ru-lost-found/shared';
import { createLogger } from '../apps/api/src/core/logger/logger';
import { MongoDatabase } from '../apps/api/src/infrastructure/database/MongoDatabase';
import { ObjectIdGenerator } from '../apps/api/src/infrastructure/database/objectIds';
import { Item } from '../apps/api/src/modules/items/domain/Item';
import { MongoItemRepository } from '../apps/api/src/modules/items/infrastructure/MongoItemRepository';
import { MongoUniversityRepository } from '../apps/api/src/modules/universities/infrastructure/MongoUniversityRepository';
import { User } from '../apps/api/src/modules/users/domain/User';
import { MongoUserRepository } from '../apps/api/src/modules/users/infrastructure/MongoUserRepository';

const USERS = 300;
const ITEMS = 600;
const PASSWORD = 'Load-test-pass-1';
const THINGS = ['keys', 'phone', 'wallet', 'bottle', 'charger', 'earphones', 'umbrella', 'ID card', 'notebook', 'calculator'];
const COLOURS = ['black', 'blue', 'red', 'silver', 'green', 'white'];
const PLACES = ['Library', 'Canteen', 'Hostel A', 'Sports complex', 'Auditorium', 'Lab 2'];

const uri = process.env.MONGODB_URI;
if (!uri) throw new Error('Set MONGODB_URI');
const logger = createLogger({ NODE_ENV: 'production', LOG_LEVEL: 'warn' });
const database = await MongoDatabase.connect(uri, logger);
const ids = new ObjectIdGenerator();
const pick = <T>(list: readonly T[], n: number) => list[n % list.length] as T;

try {
  const university = await new MongoUniversityRepository(database.connection).findBySlug('rishihood');
  if (!university) throw new Error('Run the seed first (docker compose up runs it).');
  const users = new MongoUserRepository(database.connection);
  const items = new MongoItemRepository(database.connection);
  // Production cost factor, so sign-ins in the test cost what they cost for real.
  const passwordHash = await bcrypt.hash(PASSWORD, 12);
  const now = new Date();

  const people: User[] = [];
  for (let n = 0; n < USERS; n++) {
    const email = `load.user${n}@rishihood.edu.in`;
    const existing = await users.findByEmail(email);
    if (existing) {
      people.push(existing);
      continue;
    }
    const user = User.register({
      id: ids.next(),
      universityId: university.id,
      email,
      passwordHash,
      profile: {
        firstName: `Load${n}`,
        lastName: 'Tester',
        year: (n % 4) + 1,
        school: pick(university.schools, n),
        enrollmentNumber: `LT${n}`,
        phone: null,
      },
      now,
    });
    user.clearEvents();
    await users.create(user);
    people.push(user);
  }

  for (let n = 0; n < ITEMS; n++) {
    const reporter = pick(people, n * 7);
    const thing = pick(THINGS, n);
    const item = Item.report({
      id: ids.next(),
      universityId: university.id,
      reporterId: reporter.id,
      type: n % 3 === 0 ? 'LOST' : 'FOUND',
      category: pick(ITEM_CATEGORIES, n),
      title: `${pick(COLOURS, n * 3)} ${thing}`,
      description: `A ${pick(COLOURS, n * 3)} ${thing}, seen near the ${pick(PLACES, n).toLowerCase()}.`,
      location: pick(PLACES, n),
      occurredOn: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())),
      images: [{ url: '/brand/symbol.png', publicId: `load/${n}` }],
      questions: [],
      heldAtSecurityDesk: n % 5 === 0,
      now: new Date(now.getTime() - n * 60_000),
    });
    item.clearEvents();
    await items.create(item);
  }
  process.stdout.write(`Seeded ${USERS} accounts and ${ITEMS} posts.\n`);
} finally {
  await database.disconnect();
}
