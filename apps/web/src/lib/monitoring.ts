/**
 * Error tracking (Sentry), only when VITE_SENTRY_DSN is set at build time. The SDK is a separate
 * chunk, loaded once the page has finished loading and the browser is idle: it costs nothing when
 * disabled and never competes with the first paint. Errors reported before then wait for it.
 * No personal data is collected: no user details, cookies, headers, bodies or query strings.
 */
type Sentry = typeof import('./sentry');

const dsn = import.meta.env.VITE_SENTRY_DSN;
let sentry: Promise<Sentry | null> = Promise.resolve(null);

export function startMonitoring(): void {
  if (!dsn) return;
  sentry = afterPageLoad()
    .then(() => import('./sentry'))
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

function afterPageLoad(): Promise<void> {
  return new Promise((resolve) => {
    const whenIdle = () => {
      if ('requestIdleCallback' in window)
        window.requestIdleCallback(() => resolve(), { timeout: 3000 });
      else setTimeout(resolve, 200);
    };
    if (document.readyState === 'complete') whenIdle();
    else window.addEventListener('load', whenIdle, { once: true });
  });
}

/** Reports an error the app caught itself (e.g. in the error boundary). Never throws. */
export function reportError(error: unknown): void {
  void sentry.then((Sentry) => Sentry?.captureException(error)).catch(() => undefined);
}
