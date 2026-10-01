/**
 * Error tracking (Sentry), only when VITE_SENTRY_DSN is set at build time. The SDK is loaded as a
 * separate chunk after start-up, so it costs nothing when disabled and doesn't delay first paint.
 * No personal data is collected: no user details, cookies, headers, bodies or query strings.
 */
type Sentry = typeof import('@sentry/react');

const dsn = import.meta.env.VITE_SENTRY_DSN;
let sentry: Promise<Sentry | null> = Promise.resolve(null);

export function startMonitoring(): void {
  if (!dsn) return;
  sentry = import('@sentry/react')
    .then((Sentry) => {
      Sentry.init({
        dsn,
        environment: import.meta.env.MODE,
        release: import.meta.env.VITE_RELEASE,
        tracesSampleRate: 0,
        dataCollection: {
          userInfo: false,
          cookies: false,
          httpHeaders: false,
          httpBodies: [],
          urlQueryParams: false,
        },
      });
      return Sentry;
    })
    .catch(() => null);
}

/** Reports an error the app caught itself (e.g. in the error boundary). Never throws. */
export function reportError(error: unknown): void {
  void sentry.then((Sentry) => Sentry?.captureException(error)).catch(() => undefined);
}
