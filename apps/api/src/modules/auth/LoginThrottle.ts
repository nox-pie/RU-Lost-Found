import type { KeyValueStore } from '../../core/cache/KeyValueStore';
import { RateLimitError } from '../../core/errors/AppError';

/** Failed sign-ins allowed per account from one address, and per account overall. */
export const LOGIN_FAILURE_LIMITS = {
  perAccountAndIp: { limit: 10, windowSeconds: 15 * 60 },
  perAccount: { limit: 50, windowSeconds: 60 * 60 },
} as const;

/**
 * Slows down password guessing without letting strangers lock people out.
 *
 * Only *failed* attempts count, so a correct password isn't blocked by someone else's attempts
 * unless they make 50 failed attempts in an hour. Per address and account, 10 failures per
 * 15 minutes; the per-IP route limit caps attacks across many accounts.
 */
export class LoginThrottle {
  constructor(private readonly store: KeyValueStore) {}

  async assertAllowed(email: string, ip: string | null): Promise<void> {
    const [fromThisIp, total] = await Promise.all([
      this.store.get(this.ipKey(email, ip)),
      this.store.get(this.accountKey(email)),
    ]);
    const { perAccountAndIp, perAccount } = LOGIN_FAILURE_LIMITS;
    if (Number(fromThisIp ?? 0) >= perAccountAndIp.limit) {
      throw new RateLimitError(
        perAccountAndIp.windowSeconds,
        'Too many failed sign-ins. Please wait a few minutes.',
      );
    }
    if (Number(total ?? 0) >= perAccount.limit) {
      throw new RateLimitError(
        perAccount.windowSeconds,
        'Too many failed sign-ins. Please try again later or reset your password.',
      );
    }
  }

  async recordFailure(email: string, ip: string | null): Promise<void> {
    const { perAccountAndIp, perAccount } = LOGIN_FAILURE_LIMITS;
    await Promise.all([
      this.store.increment(this.ipKey(email, ip), perAccountAndIp.windowSeconds),
      this.store.increment(this.accountKey(email), perAccount.windowSeconds),
    ]);
  }

  private ipKey(email: string, ip: string | null): string {
    return `login-failures:${email}:${ip ?? 'unknown'}`;
  }

  private accountKey(email: string): string {
    return `login-failures:${email}`;
  }
}
