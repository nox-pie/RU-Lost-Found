import { describe, expect, inject, it } from 'vitest';
import { createLogger } from '../../core/logger/logger';
import { MongoDatabase } from './MongoDatabase';

const logger = createLogger({ NODE_ENV: 'test', LOG_LEVEL: 'silent' });

describe('MongoDatabase', () => {
  it('connects, reports healthy, and reports unhealthy once closed', async () => {
    const database = await MongoDatabase.connect(inject('mongoUri'), logger);

    expect(await database.isHealthy()).toBe(true);
    await database.disconnect();
    expect(await database.isHealthy()).toBe(false);
  });

  it('fails fast with a clear error when the server cannot be reached', async () => {
    await expect(
      MongoDatabase.connect('mongodb://127.0.0.1:1/nowhere', logger, {
        serverSelectionTimeoutMS: 300,
      }),
    ).rejects.toThrow();
  });
});
