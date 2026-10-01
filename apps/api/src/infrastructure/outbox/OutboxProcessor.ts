import type { Clock } from '../../core/domain/Clock';
import type { EventHandlerRegistry } from '../../core/events/EventHandler';
import type { Logger } from '../../core/logger/logger';
import { noErrorReporting, type ErrorReporter } from '../../core/observability/ErrorReporter';
import type { ClaimedEvent, MongoOutbox } from './MongoOutbox';

export const OUTBOX_MAX_ATTEMPTS = 5;
/** How long a claimed event stays locked before another worker may take it over. */
const LEASE_SECONDS = 60;
const BASE_RETRY_DELAY_SECONDS = 30;

/** Exponential back-off: 30 s, 1 min, 2 min, 4 min, … */
export function retryDelaySeconds(attempt: number): number {
  return BASE_RETRY_DELAY_SECONDS * 2 ** Math.max(0, attempt - 1);
}

/**
 * Delivers outbox events to their handlers.
 *
 * - Each handler's success is recorded, so a retry only re-runs the handlers that failed.
 * - Failures are retried with exponential back-off; after OUTBOX_MAX_ATTEMPTS the event is
 *   marked FAILED and kept for inspection instead of being retried forever.
 */
export class OutboxProcessor {
  constructor(
    private readonly outbox: MongoOutbox,
    private readonly handlers: EventHandlerRegistry,
    private readonly clock: Clock,
    private readonly logger: Logger,
    private readonly reporter: ErrorReporter = noErrorReporting,
  ) {}

  /** Processes ready events until none are left or `max` have been handled. Returns how many. */
  async processBatch(max = 50): Promise<number> {
    let processed = 0;
    while (processed < max) {
      const event = await this.outbox.claimNext(this.clock.now(), LEASE_SECONDS);
      if (!event) break;
      await this.process(event);
      processed += 1;
    }
    return processed;
  }

  private async process(event: ClaimedEvent): Promise<void> {
    const pending = this.handlers
      .handlersFor(event.type)
      .filter((handler) => !event.completedHandlers.includes(handler.name));

    const failures: string[] = [];
    const errors: { handler: string; err: unknown }[] = [];
    for (const handler of pending) {
      try {
        await handler.handle(event);
        await this.outbox.markHandlerDone(event.id, handler.name);
      } catch (err) {
        failures.push(`${handler.name}: ${err instanceof Error ? err.message : String(err)}`);
        errors.push({ handler: handler.name, err });
        this.logger.warn(
          { err, eventId: event.id, eventType: event.type, handler: handler.name },
          'Event handler failed',
        );
      }
    }

    const now = this.clock.now();
    if (failures.length === 0) {
      await this.outbox.complete(event.id, now);
      return;
    }

    const error = failures.join('; ').slice(0, 1000);
    if (event.attempts >= OUTBOX_MAX_ATTEMPTS) {
      this.logger.error(
        { eventId: event.id, eventType: event.type, error },
        'Event delivery gave up',
      );
      // Reported once, when retrying stops: earlier failures may be temporary.
      for (const { handler, err } of errors) {
        this.reporter.capture(err, {
          area: 'outbox',
          eventId: event.id,
          eventType: event.type,
          handler,
        });
      }
      await this.outbox.fail(event.id, now, error);
      return;
    }
    const retryAt = new Date(now.getTime() + retryDelaySeconds(event.attempts) * 1000);
    await this.outbox.retryLater(event.id, retryAt, error);
  }
}
