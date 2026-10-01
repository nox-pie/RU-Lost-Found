import type { ErrorContext, ErrorReporter } from '../core/observability/ErrorReporter';

/** Keeps reported errors so tests can check what would reach error tracking. */
export class RecordingErrorReporter implements ErrorReporter {
  readonly reports: { error: unknown; context: ErrorContext }[] = [];

  capture(error: unknown, context: ErrorContext): void {
    this.reports.push({ error, context });
  }

  async flush(): Promise<void> {}
}
