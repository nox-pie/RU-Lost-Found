import type { ApiErrorBody, AuthResponse, ErrorCode, ErrorDetail } from '@ru-lost-found/shared';

const BASE = '/api/v1';

/** An error response from the API, with its stable machine-readable code. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode | 'NETWORK_ERROR' | 'SERVICE_UNAVAILABLE',
    message: string,
    readonly details: ErrorDetail[] = [],
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** Field errors keyed by field name ("body.title" → "title"), for forms. */
  get fieldErrors(): Record<string, string> {
    return Object.fromEntries(
      this.details.map((d) => [d.path.replace(/^(body|query|params)\./, ''), d.message]),
    );
  }
}

/**
 * The access token lives only in memory (never localStorage, where any injected script could
 * read it). After a page reload it is recovered from the httpOnly refresh cookie.
 */
let accessToken: string | null = null;
let refreshInFlight: Promise<AuthResponse | null> | null = null;
const expiredListeners = new Set<() => void>();

/**
 * The free hosting tier stops the API after a quiet period; the first requests then fail at the
 * hosting layer (502/503/504 with an HTML page, not our JSON) for up to a minute while it starts.
 */
const WAKE_TIMEOUT_MS = 90_000;
const WAKE_POLL_MS = 3_000;
let wakingUp: Promise<boolean> | null = null;
const wakeListeners = new Set<(waking: boolean) => void>();

function isHostingError(res: Response): boolean {
  return (
    [502, 503, 504].includes(res.status) &&
    !res.headers.get('content-type')?.includes('application/json')
  );
}

/** Notified when the app starts and stops waiting for a sleeping server (to show a notice). */
export function onServerWaking(listener: (waking: boolean) => void): () => void {
  wakeListeners.add(listener);
  return () => wakeListeners.delete(listener);
}

/** Waits until the API answers its health check again. All callers share one wait. */
function waitUntilAwake(): Promise<boolean> {
  wakingUp ??= (async () => {
    wakeListeners.forEach((listener) => listener(true));
    const deadline = Date.now() + WAKE_TIMEOUT_MS;
    try {
      while (Date.now() < deadline) {
        try {
          const res = await fetch(`${BASE}/health/live`, { cache: 'no-store' });
          if (res.ok) return true;
        } catch {
          // still starting
        }
        await new Promise((resolve) => setTimeout(resolve, WAKE_POLL_MS));
      }
      return false;
    } finally {
      wakeListeners.forEach((listener) => listener(false));
      wakingUp = null;
    }
  })();
  return wakingUp;
}

/** Starts waking the API as soon as the app opens, so it's usually up before the first form. */
export function warmUpServer(): void {
  void fetch(`${BASE}/health/live`, { cache: 'no-store' }).catch(() => undefined);
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

/** Called when the session can't be renewed (signed out elsewhere, expired, revoked). */
export function onSessionExpired(listener: () => void): () => void {
  expiredListeners.add(listener);
  return () => expiredListeners.delete(listener);
}

/**
 * Exchanges the refresh cookie for a new access token. Concurrent callers share one request:
 * the API rotates the refresh token on every use, so two parallel refreshes would race.
 */
export function refreshSession(): Promise<AuthResponse | null> {
  refreshInFlight ??= (async () => {
    const refresh = () => fetch(`${BASE}/auth/refresh`, { method: 'POST', credentials: 'include' });
    try {
      let res = await refresh();
      // A sleeping server must not look like a signed-out user. Retrying is safe: if the first
      // attempt was processed after all, the old token is still accepted for 30 seconds.
      if (isHostingError(res) && (await waitUntilAwake())) res = await refresh();
      if (!res.ok) {
        accessToken = null;
        return null;
      }
      const body = (await res.json()) as AuthResponse;
      accessToken = body.accessToken;
      return body;
    } catch {
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  json?: unknown;
  form?: FormData;
  query?: Record<string, string | number | boolean | undefined | null>;
  signal?: AbortSignal;
}

function buildUrl(path: string, query?: RequestOptions['query']): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
  }
  const search = params.toString();
  return `${BASE}${path}${search ? `?${search}` : ''}`;
}

async function toApiError(res: Response): Promise<ApiError> {
  try {
    const body = (await res.json()) as ApiErrorBody;
    return new ApiError(res.status, body.error.code, body.error.message, body.error.details ?? []);
  } catch {
    return new ApiError(res.status, 'INTERNAL_ERROR', 'Something went wrong. Please try again.');
  }
}

/**
 * Calls the API. On 401 it refreshes the session once and retries; if that fails, listeners are
 * told the session has expired (the app then shows the sign-in page).
 */
export async function api<T>(
  path: string,
  options: RequestOptions = {},
  retry = true,
  afterWake = false,
): Promise<T> {
  const res = await send(path, options);
  if (isHostingError(res)) {
    const awake = !afterWake && (await waitUntilAwake());
    // Reads are repeated automatically (once). Changes are not, because the first attempt might
    // have been processed after all: the person decides whether to send it again.
    if (awake && (options.method ?? 'GET') === 'GET') return api<T>(path, options, retry, true);
    throw new ApiError(
      res.status,
      'SERVICE_UNAVAILABLE',
      awake
        ? 'The server just woke up after a quiet period. Please try again.'
        : 'The server is not responding. Please try again in a minute.',
    );
  }

  if (res.status === 401 && retry && !path.startsWith('/auth/')) {
    if (await refreshSession()) return api<T>(path, options, false);
    expiredListeners.forEach((listener) => listener());
  }
  if (!res.ok) throw await toApiError(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

async function send(path: string, options: RequestOptions): Promise<Response> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  let body: BodyInit | undefined;
  if (options.form) {
    body = options.form; // the browser sets the multipart boundary itself
  } else if (options.json !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(options.json);
  }

  try {
    return await fetch(buildUrl(path, options.query), {
      method: options.method ?? 'GET',
      headers,
      body,
      credentials: 'include',
      signal: options.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ApiError(0, 'NETWORK_ERROR', 'Could not reach the server. Check your connection.');
  }
}
