import { randomUUID } from 'node:crypto';
import mongoose, { type Connection } from 'mongoose';
import { afterAll, afterEach, beforeAll, inject } from 'vitest';

/**
 * Gives a test file its own empty database on the shared in-memory server.
 * Collections are emptied after each test (indexes are kept) and the database is dropped at the end.
 */
export function useTestDatabase(): { readonly connection: Connection } {
  let connection: Connection | undefined;

  beforeAll(async () => {
    connection = mongoose.createConnection(inject('mongoUri'), {
      dbName: `test_${randomUUID().slice(0, 8)}`,
    });
    await connection.asPromise();
  });

  afterEach(async () => {
    if (!connection?.db) return;
    const collections = await connection.db.collections();
    await Promise.all(collections.map((collection) => collection.deleteMany({})));
  });

  afterAll(async () => {
    await connection?.dropDatabase();
    await connection?.close();
  });

  return {
    get connection() {
      if (!connection) throw new Error('The test database is only available inside tests.');
      return connection;
    },
  };
}
