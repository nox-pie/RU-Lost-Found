/** Where an unexpected error happened. Never put personal data or secrets here. */
export interface ErrorContext {
  /** e.g. "http", "outbox", "job", "worker", "process" */
  area: string;
  requestId?: string;
  userId?: string;
  route?: string;
  eventId?: string;
  eventType?: string;
  handler?: string;
  job?: string;
}

/**
 * Sends unexpected errors (bugs, outages) to an error-tracking service. Expected errors such as
 * validation failures or 404s are not reported. Implementations must never throw.
 */
export interface ErrorReporter {
  capture(error: unknown, context: ErrorContext): void;
  /** Waits (at most `timeoutMs`) for queued reports to be sent, e.g. before the process exits. */
  flush(timeoutMs: number): Promise<void>;
}

/** Used when no error tracking is configured: errors are only logged. */
export const noErrorReporting: ErrorReporter = {
  capture: () => {},
  flush: async () => {},
};
