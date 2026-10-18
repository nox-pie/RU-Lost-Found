import type { KeyValueStore } from '../../core/cache/KeyValueStore';
import type { Clock } from '../../core/domain/Clock';
import type { Logger } from '../../core/logger/logger';
import { noErrorReporting, type ErrorReporter } from '../../core/observability/ErrorReporter';

/** After the primary fails, it is skipped for this long before it is tried again. */
const RETRY_PRIMARY_AFTER_MS = 30_000;
/** A primary call slower than this counts as failed (an unreachable Redis waits for its retries). */
const PRIMARY_TIMEOUT_MS = 1_500;

function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`No answer from the key-value store in ${ms} ms`)),
      ms,
    );
  });
  return Promise.race([work, timeout]).finally(() => clearTimeout(timer));
}

/**
 * Decorator: keeps the API working when the shared store (Redis) is unreachable. Calls go to the
 * primary; when it fails or hangs, the in-process fallback answers instead, and the primary is
 * skipped for a while (a simple circuit breaker) so requests don't each wait for a dead connection.
 *
 * While degraded, values live only in this process: codes issued before the outage must be
 * requested again, and with several instances each counts rate limits and takes job leases on its
 * own. That costs far less than refusing every sign-in and every change until Redis is back.
 */
export class FallbackKeyValueStore implements KeyValueStore {
  private skipPrimaryUntil = 0;
  private degraded = false;

  constructor(
    private readonly primary: KeyValueStore,
    private readonly fallback: KeyValueStore,
    private readonly clock: Clock,
    private readonly logger: Logger,
    private readonly reporter: ErrorReporter = noErrorReporting,
    private readonly timeoutMs = PRIMARY_TIMEOUT_MS,
  ) {}

  get(key: string): Promise<string | null> {
    return this.call((store) => store.get(key));
  }

  set(key: string, value: string, ttlSeconds: number): Promise<void> {
    return this.call((store) => store.set(key, value, ttlSeconds));
  }

  delete(...keys: string[]): Promise<void> {
    return this.call((store) => store.delete(...keys));
  }

  increment(
    key: string,
    windowSeconds: number,
  ): Promise<{ count: number; resetInSeconds: number }> {
    return this.call((store) => store.increment(key, windowSeconds));
  }

  private async call<T>(operation: (store: KeyValueStore) => Promise<T>): Promise<T> {
    const now = this.clock.now().getTime();
    if (now < this.skipPrimaryUntil) return operation(this.fallback);
    try {
      const result = await withTimeout(operation(this.primary), this.timeoutMs);
      if (this.degraded) {
        this.degraded = false;
        this.logger.info('Key-value store is reachable again; leaving the in-memory fallback');
      }
      return result;
    } catch (err) {
      this.skipPrimaryUntil = now + RETRY_PRIMARY_AFTER_MS;
      if (!this.degraded) {
        // Once per outage: every request would otherwise report the same problem.
        this.degraded = true;
        this.logger.error({ err }, 'Key-value store unreachable; using the in-memory fallback');
        this.reporter.capture(err, { area: 'cache' });
      }
      return operation(this.fallback);
    }
  }
}
