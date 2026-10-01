import type { KeyValueStore } from '../../core/cache/KeyValueStore';
import type { Logger } from '../../core/logger/logger';
import { noErrorReporting, type ErrorReporter } from '../../core/observability/ErrorReporter';

export interface ScheduledJob {
  name: string;
  intervalSeconds: number;
  run(): Promise<unknown>;
}

/**
 * Runs jobs on a fixed interval. With several API instances, a lease in the shared key-value
 * store (Redis) makes sure each job runs on only one of them per interval. A job that is still
 * running when its next turn comes is skipped rather than started twice.
 */
export class JobScheduler {
  private readonly timers: NodeJS.Timeout[] = [];
  private readonly running = new Map<string, Promise<void>>();

  constructor(
    private readonly jobs: readonly ScheduledJob[],
    private readonly leases: KeyValueStore,
    private readonly logger: Logger,
    private readonly reporter: ErrorReporter = noErrorReporting,
  ) {}

  start(): void {
    for (const job of this.jobs) {
      const timer = setInterval(() => void this.trigger(job), job.intervalSeconds * 1000);
      timer.unref();
      this.timers.push(timer);
    }
  }

  async stop(): Promise<void> {
    this.timers.forEach((timer) => clearInterval(timer));
    this.timers.length = 0;
    await Promise.allSettled(this.running.values());
  }

  /** Runs a job immediately, without taking the lease (for tests and manual runs). */
  async runNow(name: string): Promise<unknown> {
    const job = this.jobs.find((candidate) => candidate.name === name);
    if (!job) throw new Error(`Unknown job: ${name}`);
    return job.run();
  }

  private async trigger(job: ScheduledJob): Promise<void> {
    if (this.running.has(job.name)) return;
    const { count } = await this.leases.increment(`job-lease:${job.name}`, job.intervalSeconds);
    if (count > 1) return; // another instance has this interval

    const run = (async () => {
      const startedAt = Date.now();
      try {
        const result = await job.run();
        this.logger.info({ job: job.name, result, ms: Date.now() - startedAt }, 'Job finished');
      } catch (err) {
        this.logger.error({ err, job: job.name }, 'Job failed');
        this.reporter.capture(err, { area: 'job', job: job.name });
      } finally {
        this.running.delete(job.name);
      }
    })();
    this.running.set(job.name, run);
    await run;
  }
}
