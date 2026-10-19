/** Work that runs on a fixed interval (see infrastructure/worker/JobScheduler). */
export interface ScheduledJob {
  name: string;
  intervalSeconds: number;
  run(): Promise<unknown>;
}
