import type { Logger } from '../../core/logger/logger';
import { noErrorReporting, type ErrorReporter } from '../../core/observability/ErrorReporter';
import type { OutboxProcessor } from '../outbox/OutboxProcessor';
import type { JobScheduler } from './JobScheduler';

/**
 * Everything that happens outside HTTP requests: delivering outbox events (polling every few
 * seconds) and running scheduled jobs. Runs inside the API process on the free tier and can be
 * moved to its own process without code changes (see src/worker.ts).
 */
export class BackgroundWorker {
  private stopped = true;
  private loop: Promise<void> | undefined;
  private wake: (() => void) | undefined;

  constructor(
    private readonly processor: OutboxProcessor,
    readonly scheduler: JobScheduler,
    private readonly logger: Logger,
    private readonly pollIntervalMs = 2000,
    private readonly reporter: ErrorReporter = noErrorReporting,
  ) {}

  start(): void {
    if (!this.stopped) return;
    this.stopped = false;
    this.scheduler.start();
    this.loop = this.poll();
    this.logger.info('Background worker started');
  }

  /** Finishes the event being processed and running jobs, then stops. */
  async stop(): Promise<void> {
    if (this.stopped) return;
    this.stopped = true;
    this.wake?.();
    await this.loop;
    await this.scheduler.stop();
    this.logger.info('Background worker stopped');
  }

  /** Delivers every ready event now, including events those deliveries produce. */
  async drain(): Promise<number> {
    let total = 0;
    for (;;) {
      const processed = await this.processor.processBatch();
      if (processed === 0) return total;
      total += processed;
    }
  }

  private async poll(): Promise<void> {
    while (!this.stopped) {
      try {
        const processed = await this.processor.processBatch();
        if (processed > 0) continue;
      } catch (err) {
        this.logger.error({ err }, 'Outbox polling failed');
        this.reporter.capture(err, { area: 'worker' });
      }
      await this.sleep(this.pollIntervalMs);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      const timer = setTimeout(done, ms);
      function done() {
        clearTimeout(timer);
        resolve();
      }
      this.wake = done;
    });
  }
}
