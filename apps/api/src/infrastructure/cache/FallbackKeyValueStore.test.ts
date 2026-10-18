import { describe, expect, it } from 'vitest';
import type { KeyValueStore } from '../../core/cache/KeyValueStore';
import { createLogger } from '../../core/logger/logger';
import { FixedClock, T0 } from '../../testing/builders';
import { RecordingErrorReporter } from '../../testing/RecordingErrorReporter';
import { FallbackKeyValueStore } from './FallbackKeyValueStore';
import { InMemoryKeyValueStore } from './InMemoryKeyValueStore';

const logger = createLogger({ NODE_ENV: 'test', LOG_LEVEL: 'silent' });
const seconds = (n: number) => new Date(T0.getTime() + n * 1000);

/** A store whose availability the test switches, counting the calls it receives. */
class SwitchableStore extends InMemoryKeyValueStore {
  down = false;
  hang = false;
  calls = 0;
  private check<T>(work: () => Promise<T>): Promise<T> {
    this.calls += 1;
    if (this.hang) return new Promise<T>(() => {});
    if (this.down) return Promise.reject(new Error('connect ECONNREFUSED'));
    return work();
  }
  override get(key: string) {
    return this.check(() => super.get(key));
  }
  override set(key: string, value: string, ttl: number) {
    return this.check(() => super.set(key, value, ttl));
  }
  override delete(...keys: string[]) {
    return this.check(() => super.delete(...keys));
  }
  override increment(key: string, windowSeconds: number) {
    return this.check(() => super.increment(key, windowSeconds));
  }
}

function setup(timeoutMs = 50) {
  const clock = new FixedClock();
  const primary = new SwitchableStore(clock);
  const fallback = new InMemoryKeyValueStore(clock);
  const reporter = new RecordingErrorReporter();
  const store: KeyValueStore = new FallbackKeyValueStore(
    primary,
    fallback,
    clock,
    logger,
    reporter,
    timeoutMs,
  );
  return { clock, primary, fallback, reporter, store };
}

describe('FallbackKeyValueStore', () => {
  it('uses the primary store while it works', async () => {
    const { primary, fallback, store } = setup();
    await store.set('k', 'v', 60);

    expect(await store.get('k')).toBe('v');
    expect(await primary.get('k')).toBe('v');
    expect(await fallback.get('k')).toBeNull();
  });

  it('answers from memory when the primary fails, and reports the outage once', async () => {
    const { primary, reporter, store } = setup();
    primary.down = true;

    expect(await store.increment('ratelimit:login', 60)).toEqual({ count: 1, resetInSeconds: 60 });
    expect(await store.increment('ratelimit:login', 60)).toEqual({ count: 2, resetInSeconds: 60 });
    await store.set('otp', 'hash', 600);
    expect(await store.get('otp')).toBe('hash');

    expect(reporter.reports).toHaveLength(1);
    expect(reporter.reports[0]?.context).toMatchObject({ area: 'cache' });
  });

  it('stops calling a failed primary for a while, then tries it again and recovers', async () => {
    const { clock, primary, store } = setup();
    primary.down = true;
    await store.get('a');
    const callsAfterFailure = primary.calls;

    await store.get('b');
    await store.get('c');
    expect(primary.calls).toBe(callsAfterFailure); // skipped: no waiting on a dead connection

    primary.down = false;
    clock.set(seconds(31));
    await store.set('d', 'back', 60);
    expect(await primary.get('d')).toBe('back');
  });

  it('treats a primary that hangs as failed', async () => {
    const { primary, store } = setup(20);
    primary.hang = true;

    await expect(store.increment('ratelimit:writes', 60)).resolves.toEqual({
      count: 1,
      resetInSeconds: 60,
    });
  });
});
