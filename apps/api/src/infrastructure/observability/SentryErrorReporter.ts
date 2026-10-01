import * as Sentry from '@sentry/node';
import type { ErrorContext, ErrorReporter } from '../../core/observability/ErrorReporter';

export interface SentryConfig {
  dsn: string;
  environment: string;
  release?: string;
}

const SENSITIVE_HEADERS = ['authorization', 'cookie', 'set-cookie'];

/**
 * Adapter for Sentry (free tier: 5,000 errors a month). Only errors are sent, no performance
 * traces, and requests are stripped of cookies, tokens and IP addresses before leaving the server.
 */
export class SentryErrorReporter implements ErrorReporter {
  constructor(config: SentryConfig) {
    Sentry.init({
      dsn: config.dsn,
      environment: config.environment,
      release: config.release,
      tracesSampleRate: 0,
      // Collect no personal data: no user details, cookies, headers, bodies or query strings.
      dataCollection: {
        userInfo: false,
        cookies: false,
        httpHeaders: false,
        httpBodies: [],
        urlQueryParams: false,
      },
      // Defence in depth, in case an integration attaches request data anyway.
      beforeSend(event) {
        if (event.request) {
          delete event.request.cookies;
          delete event.request.data;
          for (const header of SENSITIVE_HEADERS) delete event.request.headers?.[header];
        }
        if (event.user) event.user = { id: event.user.id };
        return event;
      },
    });
  }

  capture(error: unknown, context: ErrorContext): void {
    try {
      Sentry.withScope((scope) => {
        const { area, userId, ...rest } = context;
        scope.setTag('area', area);
        if (userId) scope.setUser({ id: userId });
        for (const [key, value] of Object.entries(rest)) {
          if (value !== undefined) scope.setTag(key, value);
        }
        Sentry.captureException(error);
      });
    } catch {
      // Error reporting must never cause an error of its own.
    }
  }

  async flush(timeoutMs: number): Promise<void> {
    await Sentry.flush(timeoutMs).catch(() => false);
  }
}
