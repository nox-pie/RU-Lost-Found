import 'dotenv/config';
import { ROLES, type Role } from '@ru-lost-found/shared';
import { loadEnv } from '../config/env';
import { SystemClock } from '../core/domain/Clock';
import { createLogger } from '../core/logger/logger';
import { MongoDatabase } from '../infrastructure/database/MongoDatabase';
import { MongoOutbox } from '../infrastructure/outbox/MongoOutbox';
import { MongoUserRepository } from '../modules/users/infrastructure/MongoUserRepository';

/**
 * Appoints the first admin of a deployment (after that, admins manage roles in the app):
 *
 *   npm run set-role -- someone@rishihood.edu.in UNIVERSITY_ADMIN
 *
 * The person must have signed up already. The change goes through the outbox like any other,
 * so it appears in the audit log once the API's worker runs.
 */
async function setRole(email: string | undefined, role: string | undefined): Promise<void> {
  if (!email || !ROLES.includes(role as Role)) {
    throw new Error(`Usage: npm run set-role -- <email> <${ROLES.join('|')}>`);
  }
  const env = loadEnv();
  const logger = createLogger(env);
  const database = await MongoDatabase.connect(env.MONGODB_URI, logger);
  try {
    const users = new MongoUserRepository(
      database.connection,
      new MongoOutbox(database.connection),
    );
    const user = await users.findByEmail(email);
    if (!user) throw new Error(`No account uses ${email}. Sign up first, then run this again.`);
    user.appointBySystem(role as Role, new SystemClock().now());
    await users.update(user);
    logger.info({ userId: user.id, role }, 'Role updated');
  } finally {
    await database.disconnect();
  }
}

setRole(process.argv[2], process.argv[3]).catch((err: unknown) => {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
