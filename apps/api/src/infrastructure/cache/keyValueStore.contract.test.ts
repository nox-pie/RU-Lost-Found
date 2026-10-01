import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { KeyValueStore } from '../../core/cache/KeyValueStore';
import { createLogger } from '../../core/logger/logger';
import { InMemoryKeyValueStore } from './InMemoryKeyValueStore';
import { RedisKeyValueStore } from './RedisKeyValueStore';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Contract tests: every KeyValueStore implementation must behave the same way, so the rest of
 * the code can use any of them (Liskov substitution). The Redis suite runs when REDIS_URL is set
 * (CI starts a Redis service); the in-memory suite always runs.
 */
function keyValueStoreContract(
  name: string,
  setup: () => Promise<{ store: KeyValueStore; teardown: () => Promise<void> }>,
  options: { skip?: boolean } = {},
) {
  describe.skipIf(options.skip)(`${name} (KeyValueStore contract)`, () => {
    let store: KeyValueStore;
    let teardown: () => Promise<void>;
    // A fresh prefix per run, so parallel runs against one Redis never collide.
    const key = (suffix: string) => `contract:${randomUUID()}:${suffix}`;

    beforeAll(async () => {
      ({ store, teardown } = await setup());
    });
    afterAll(async () => {
      await teardown();
    });

    it('stores, reads and deletes values', async () => {
      const [a, b] = [key('a'), key('b')];
      await store.set(a, 'one', 60);
      await store.set(b, 'two', 60);

      expect(await store.get(a)).toBe('one');
      await store.delete(a, b);
      expect(await store.get(a)).toBeNull();
      expect(await store.get(b)).toBeNull();
      expect(await store.get(key('missing'))).toBeNull();
    });

    it('overwrites a value', async () => {
      const k = key('overwrite');
      await store.set(k, 'first', 60);
      await store.set(k, 'second', 60);

      expect(await store.get(k)).toBe('second');
    });

    it('counts in a window that starts at the first increment', async () => {
      const k = key('counter');

      const first = await store.increment(k, 60);
      const second = await store.increment(k, 60);

      expect(first.count).toBe(1);
      expect(second.count).toBe(2);
      expect(second.resetInSeconds).toBeGreaterThan(0);
      expect(second.resetInSeconds).toBeLessThanOrEqual(60);
    });

    it('forgets values and counters when their time is up', async () => {
      const [value, counter] = [key('ttl'), key('ttl-counter')];
      await store.set(value, 'short-lived', 1);
      await store.increment(counter, 1);

      await sleep(1_200);

      expect(await store.get(value)).toBeNull();
      expect((await store.increment(counter, 1)).count).toBe(1);
    });

    it('accepts deleting nothing', async () => {
      await expect(store.delete()).resolves.toBeUndefined();
    });
  });
}

keyValueStoreContract('InMemoryKeyValueStore', async () => ({
  store: new InMemoryKeyValueStore(),
  teardown: async () => {},
}));

const redisUrl = process.env.REDIS_URL;
keyValueStoreContract(
  'RedisKeyValueStore',
  async () => {
    const logger = createLogger({ NODE_ENV: 'test', LOG_LEVEL: 'silent' });
    const store = await RedisKeyValueStore.connect(redisUrl as string, logger, 'rlf-test:');
    expect(await store.isHealthy()).toBe(true);
    return { store, teardown: () => store.disconnect() };
  },
  { skip: !redisUrl },
);
