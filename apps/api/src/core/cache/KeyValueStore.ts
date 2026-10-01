/**
 * Small, expiring key-value store for short-lived data: one-time codes, attempt counters,
 * rate-limit windows. Redis in production, memory in development and tests.
 */
export interface KeyValueStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
  delete(...keys: string[]): Promise<void>;
  /**
   * Adds one to a counter. The expiry is set only when the counter is created, so the counter
   * resets `windowSeconds` after the first increment (a fixed window).
   */
  increment(key: string, windowSeconds: number): Promise<{ count: number; resetInSeconds: number }>;
}
