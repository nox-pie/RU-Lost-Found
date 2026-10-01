import type { Env } from '../../config/env';
import { noErrorReporting, type ErrorReporter } from '../../core/observability/ErrorReporter';
import { SentryErrorReporter } from './SentryErrorReporter';

/** Sentry when SENTRY_DSN is set; otherwise errors are only logged. */
export function createErrorReporter(env: Env): ErrorReporter {
  if (!env.SENTRY_DSN) return noErrorReporting;
  return new SentryErrorReporter({
    dsn: env.SENTRY_DSN,
    environment: env.SENTRY_ENVIRONMENT ?? env.NODE_ENV,
    release: env.SENTRY_RELEASE ?? env.RENDER_GIT_COMMIT,
  });
}
