import type { ApiErrorBody, AuthResponse, ErrorCode, ErrorDetail } from '@ru-lost-found/shared';

const BASE = '/api/v1';

/** An error response from the API, with its stable machine-readable code. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode | 'NETWORK_ERROR',
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
    try {
      const res = await fetch(`${BASE}/auth/refresh`, { method: 'POST', credentials: 'include' });
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
export async function api<T>(path: string, options: RequestOptions = {}, retry = true): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  let body: BodyInit | undefined;
  if (options.form) {
    body = options.form; // the browser sets the multipart boundary itself
  } else if (options.json !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(options.json);
  }

  let res: Response;
  try {
    res = await fetch(buildUrl(path, options.query), {
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

  if (res.status === 401 && retry && !path.startsWith('/auth/')) {
    if (await refreshSession()) return api<T>(path, options, false);
    expiredListeners.forEach((listener) => listener());
  }
  if (!res.ok) throw await toApiError(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
