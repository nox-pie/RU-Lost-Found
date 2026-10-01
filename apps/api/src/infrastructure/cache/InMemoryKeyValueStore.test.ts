import { describe, expect, it } from 'vitest';
import { FixedClock, T0 } from '../../testing/builders';
import { InMemoryKeyValueStore } from './InMemoryKeyValueStore';

const seconds = (n: number) => new Date(T0.getTime() + n * 1000);

describe('InMemoryKeyValueStore', () => {
  it('forgets values after their time to live', async () => {
    const clock = new FixedClock();
    const store = new InMemoryKeyValueStore(clock);
    await store.set('k', 'v', 10);

    clock.set(seconds(9));
    expect(await store.get('k')).toBe('v');
    clock.set(seconds(10));
    expect(await store.get('k')).toBeNull();
  });

  it('counts within a fixed window that starts at the first increment', async () => {
    const clock = new FixedClock();
    const store = new InMemoryKeyValueStore(clock);

    expect(await store.increment('c', 60)).toEqual({ count: 1, resetInSeconds: 60 });
    clock.set(seconds(45));
    expect(await store.increment('c', 60)).toEqual({ count: 2, resetInSeconds: 15 });
    clock.set(seconds(60));
    expect(await store.increment('c', 60)).toEqual({ count: 1, resetInSeconds: 60 });
  });

  it('deletes several keys at once', async () => {
    const store = new InMemoryKeyValueStore(new FixedClock());
    await store.set('a', '1', 60);
    await store.set('b', '2', 60);

    await store.delete('a', 'b');

    expect(await store.get('a')).toBeNull();
    expect(await store.get('b')).toBeNull();
  });
});
