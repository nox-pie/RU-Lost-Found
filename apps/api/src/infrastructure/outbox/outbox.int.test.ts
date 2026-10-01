import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { EventHandler, StoredEvent } from '../../core/events/EventHandler';
import { EventHandlerRegistry } from '../../core/events/EventHandler';
import { ConcurrencyError } from '../../core/errors/AppError';
import { createLogger } from '../../core/logger/logger';
import { MongoItemRepository } from '../../modules/items/infrastructure/MongoItemRepository';
import { MongoUserRepository } from '../../modules/users/infrastructure/MongoUserRepository';
import { FixedClock, T0, aFoundItem, aUser, minutesAfter } from '../../testing/builders';
import { useTestDatabase } from '../../testing/testDatabase';
import { InMemoryKeyValueStore } from '../cache/InMemoryKeyValueStore';
import { MongoUnitOfWork } from '../database/MongoUnitOfWork';
import { BackgroundWorker } from '../worker/BackgroundWorker';
import { JobScheduler } from '../worker/JobScheduler';
import { MongoOutbox } from './MongoOutbox';
import { OUTBOX_MAX_ATTEMPTS, OutboxProcessor, retryDelaySeconds } from './OutboxProcessor';
import { RecordingErrorReporter } from '../../testing/RecordingErrorReporter';

const db = useTestDatabase();
const logger = createLogger({ NODE_ENV: 'test', LOG_LEVEL: 'silent' });
const clock = new FixedClock();

let outbox: MongoOutbox;
let users: MongoUserRepository;
let items: MongoItemRepository;

beforeAll(async () => {
  outbox = new MongoOutbox(db.connection);
  users = new MongoUserRepository(db.connection, outbox);
  items = new MongoItemRepository(db.connection, outbox);
  await Promise.all([outbox.ensureIndexes(), users.ensureIndexes(), items.ensureIndexes()]);
});

afterEach(() => clock.set(T0));

/** A handler that records calls and fails the first `failTimes` times. */
function recordingHandler(name: string, type: string, failTimes = 0) {
  const calls: StoredEvent[] = [];
  let failuresLeft = failTimes;
  const handler: EventHandler = {
    name,
    handles: [type],
    async handle(event) {
      calls.push(event);
      if (failuresLeft > 0) {
        failuresLeft -= 1;
        throw new Error(`${name} is down`);
      }
    },
  };
  return { handler, calls };
}

const processorWith = (...handlers: EventHandler[]) =>
  new OutboxProcessor(outbox, new EventHandlerRegistry(handlers), clock, logger);

describe('storing events with the change that produced them', () => {
  it('writes an aggregate and its events together', async () => {
    const user = aUser();

    await users.create(user);

    expect(await outbox.countByStatus('PENDING')).toBe(1);
    expect(user.peekEvents()).toHaveLength(0);
  });

  it('writes no event when the transaction rolls back', async () => {
    const unitOfWork = new MongoUnitOfWork(db.connection);

    await expect(
      unitOfWork.run(async (tx) => {
        await items.create(aFoundItem(), tx);
        throw new Error('something later failed');
      }),
    ).rejects.toThrow('something later failed');

    expect(await outbox.countByStatus('PENDING')).toBe(0);
  });

  it('writes no event when the save loses an optimistic-concurrency race', async () => {
    const item = aFoundItem();
    await items.create(item);
    await outbox.claimNext(T0, 60); // take the ItemReported event out of the way
    const tabA = await items.findById({ universityId: item.universityId }, item.id);
    const tabB = await items.findById({ universityId: item.universityId }, item.id);
    tabA!.reserve(T0);
    await items.update(tabA!);

    tabB!.remove({ userId: item.reporterId, role: 'STUDENT' }, T0);

    await expect(items.update(tabB!)).rejects.toThrow(ConcurrencyError);
    expect(await outbox.countByStatus('PENDING')).toBe(0);
  });
});

describe('OutboxProcessor', () => {
  it('delivers each event to its handlers and marks it done', async () => {
    const { handler, calls } = recordingHandler('welcome', 'UserRegistered');
    const user = aUser();
    await users.create(user);

    const processed = await processorWith(handler).processBatch();

    expect(processed).toBe(1);
    expect(calls.map((e) => e.aggregateId)).toEqual([user.id]);
    expect(await outbox.countByStatus('DONE')).toBe(1);
  });

  it('retries a failed delivery with back-off', async () => {
    const { handler, calls } = recordingHandler('flaky', 'UserRegistered', 1);
    await users.create(aUser());
    const processor = processorWith(handler);

    await processor.processBatch();
    expect(await outbox.countByStatus('PENDING')).toBe(1);

    clock.set(new Date(T0.getTime() + (retryDelaySeconds(1) - 1) * 1000));
    expect(await processor.processBatch()).toBe(0); // not due yet

    clock.set(new Date(T0.getTime() + retryDelaySeconds(1) * 1000));
    expect(await processor.processBatch()).toBe(1);
    expect(calls).toHaveLength(2);
    expect(await outbox.countByStatus('DONE')).toBe(1);
  });

  it('only re-runs the handlers that failed', async () => {
    const email = recordingHandler('email', 'UserRegistered');
    const crm = recordingHandler('crm', 'UserRegistered', 1);
    await users.create(aUser());
    const processor = processorWith(email.handler, crm.handler);

    await processor.processBatch();
    clock.set(minutesAfter(T0, 10));
    await processor.processBatch();

    expect(email.calls).toHaveLength(1);
    expect(crm.calls).toHaveLength(2);
  });

  it('gives up after the maximum number of attempts and keeps the event for inspection', async () => {
    const { handler, calls } = recordingHandler('broken', 'UserRegistered', 100);
    await users.create(aUser());
    const processor = processorWith(handler);

    for (let attempt = 1; attempt <= OUTBOX_MAX_ATTEMPTS + 2; attempt++) {
      await processor.processBatch();
      clock.set(minutesAfter(clock.now(), 60));
    }

    expect(calls).toHaveLength(OUTBOX_MAX_ATTEMPTS);
    expect(await outbox.countByStatus('FAILED')).toBe(1);
  });

  it('reports a failing handler to error tracking once, when it stops retrying', async () => {
    const reporter = new RecordingErrorReporter();
    const { handler } = recordingHandler('broken', 'UserRegistered', 100);
    await users.create(aUser());
    const processor = new OutboxProcessor(
      outbox,
      new EventHandlerRegistry([handler]),
      clock,
      logger,
      reporter,
    );

    for (let attempt = 1; attempt <= OUTBOX_MAX_ATTEMPTS; attempt++) {
      await processor.processBatch();
      if (attempt < OUTBOX_MAX_ATTEMPTS) expect(reporter.reports).toHaveLength(0);
      clock.set(minutesAfter(clock.now(), 60));
    }

    expect(reporter.reports).toMatchObject([
      { context: { area: 'outbox', eventType: 'UserRegistered', handler: 'broken' } },
    ]);
  });

  it('gives each event to exactly one worker, and takes over events a crashed worker left', async () => {
    await users.create(aUser());

    const [first, second] = await Promise.all([outbox.claimNext(T0, 60), outbox.claimNext(T0, 60)]);
    const takenOver = await outbox.claimNext(minutesAfter(T0, 2), 60);

    expect([first, second].filter(Boolean)).toHaveLength(1);
    expect(takenOver?.id).toBe((first ?? second)?.id);
    expect(takenOver?.attempts).toBe(2);
  });
});

describe('BackgroundWorker', () => {
  it('polls for events in the background and stops cleanly', async () => {
    const { handler, calls } = recordingHandler('welcome', 'UserRegistered');
    const scheduler = new JobScheduler([], new InMemoryKeyValueStore(clock), logger);
    const worker = new BackgroundWorker(processorWith(handler), scheduler, logger, 10);

    worker.start();
    await users.create(aUser());
    await vi.waitFor(() => expect(calls).toHaveLength(1), { timeout: 2000 });
    await worker.stop();

    expect(await outbox.countByStatus('DONE')).toBe(1);
  });
});

describe('JobScheduler', () => {
  it('runs each job on only one instance per interval', async () => {
    vi.useFakeTimers();
    try {
      const leases = new InMemoryKeyValueStore(clock); // shared, like Redis
      let runs = 0;
      const job = { name: 'expire', intervalSeconds: 60, run: async () => (runs += 1) };
      const instanceA = new JobScheduler([job], leases, logger);
      const instanceB = new JobScheduler([job], leases, logger);

      instanceA.start();
      instanceB.start();
      await vi.advanceTimersByTimeAsync(60_000);
      clock.set(minutesAfter(T0, 1)); // the lease window passes
      await vi.advanceTimersByTimeAsync(60_000);
      await instanceA.stop();
      await instanceB.stop();

      expect(runs).toBe(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('reports a failing job to error tracking', async () => {
    vi.useFakeTimers();
    try {
      const reporter = new RecordingErrorReporter();
      const job = {
        name: 'purge',
        intervalSeconds: 60,
        run: async () => {
          throw new Error('storage is down');
        },
      };
      const scheduler = new JobScheduler([job], new InMemoryKeyValueStore(clock), logger, reporter);

      scheduler.start();
      await vi.advanceTimersByTimeAsync(60_000);
      await scheduler.stop();

      expect(reporter.reports).toMatchObject([{ context: { area: 'job', job: 'purge' } }]);
    } finally {
      vi.useRealTimers();
    }
  });
});
