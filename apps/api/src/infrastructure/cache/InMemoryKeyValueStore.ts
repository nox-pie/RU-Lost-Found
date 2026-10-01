import type { KeyValueStore } from '../../core/cache/KeyValueStore';
import { type Clock, SystemClock } from '../../core/domain/Clock';

interface Entry {
  value: string;
  expiresAt: number;
}

const SWEEP_EVERY_WRITES = 500;

/**
 * KeyValueStore kept in process memory. Suitable for development, tests and a single
 * server instance; data is lost on restart and not shared between instances (use Redis for that).
 */
export class InMemoryKeyValueStore implements KeyValueStore {
  private readonly entries = new Map<string, Entry>();
  private writes = 0;

  constructor(private readonly clock: Clock = new SystemClock()) {}

  async get(key: string): Promise<string | null> {
    return this.live(key)?.value ?? null;
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    this.write(key, { value, expiresAt: this.now() + ttlSeconds * 1000 });
  }

  async delete(...keys: string[]): Promise<void> {
    for (const key of keys) this.entries.delete(key);
  }

  async increment(
    key: string,
    windowSeconds: number,
  ): Promise<{ count: number; resetInSeconds: number }> {
    const current = this.live(key);
    const expiresAt = current?.expiresAt ?? this.now() + windowSeconds * 1000;
    const count = Number(current?.value ?? 0) + 1;
    this.write(key, { value: String(count), expiresAt });
    return { count, resetInSeconds: Math.max(1, Math.ceil((expiresAt - this.now()) / 1000)) };
  }

  /** Removes everything (tests reset state between cases). */
  clear(): void {
    this.entries.clear();
  }

  private live(key: string): Entry | undefined {
    const entry = this.entries.get(key);
    if (entry && entry.expiresAt <= this.now()) {
      this.entries.delete(key);
      return undefined;
    }
    return entry;
  }

  private write(key: string, entry: Entry): void {
    this.entries.set(key, entry);
    if (++this.writes % SWEEP_EVERY_WRITES === 0) this.sweep();
  }

  /** Drops expired entries so abandoned keys don't accumulate. */
  private sweep(): void {
    const now = this.now();
    for (const [key, entry] of this.entries) {
      if (entry.expiresAt <= now) this.entries.delete(key);
    }
  }

  private now(): number {
    return this.clock.now().getTime();
  }
}
