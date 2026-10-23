import type { KeyValueStore } from '../../core/cache/KeyValueStore';
import type { Logger } from '../../core/logger/logger';
import type { ScheduledJob } from '../../core/jobs/ScheduledJob';
import { noErrorReporting, type ErrorReporter } from '../../core/observability/ErrorReporter';

/** How long after start-up each job gets its first turn (the app settles first). */
export const JOB_START_DELAY_MS = 30_000;

/**
 * Runs jobs on a fixed interval. With several API instances, a lease in the shared key-value
 * store (Redis) makes sure each job runs on only one of them per interval. A job that is still
 * running when its next turn comes is skipped rather than started twice.
 *
 * Each job also gets a turn shortly after start-up, because every deploy restarts the process:
 * otherwise an hourly job would wait an hour after each deploy, and a daily one would never run
 * on a day with a deploy. The lease outlives the process, so a job that some instance ran within
 * its interval is still skipped.
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
      if (job.runAtStart !== false) {
        const first = setTimeout(() => void this.trigger(job), JOB_START_DELAY_MS);
        first.unref();
        this.timers.push(first);
      }
    }
  }

  async stop(): Promise<void> {
    this.timers.forEach((timer) => clearTimeout(timer));
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
    let count: number;
    try {
      ({ count } = await this.leases.increment(`job-lease:${job.name}`, job.intervalSeconds));
    } catch (err) {
      // Runs from a timer: an error escaping here would be an unhandled rejection, which stops
      // the process. Skip this turn instead; the next interval tries again.
      this.logger.error({ err, job: job.name }, 'Could not take the job lease; skipping this run');
      this.reporter.capture(err, { area: 'job', job: job.name });
      return;
    }
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
