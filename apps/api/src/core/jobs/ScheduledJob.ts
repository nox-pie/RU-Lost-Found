/** Work that runs on a fixed interval (see infrastructure/worker/JobScheduler). */
export interface ScheduledJob {
  name: string;
  intervalSeconds: number;
  /** Also run shortly after start-up, unless it ran within its interval (default true). */
  runAtStart?: boolean;
  run(): Promise<unknown>;
}
