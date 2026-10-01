import type { Request, RequestHandler } from 'express';
import type { KeyValueStore } from '../cache/KeyValueStore';
import { RateLimitError } from '../errors/AppError';

export interface RateLimitRule {
  /** Used in the storage key, e.g. "login-ip". */
  name: string;
  limit: number;
  windowSeconds: number;
}

/** Fixed-window request counting on top of the key-value store (shared by all app instances with Redis). */
export class RateLimiter {
  constructor(private readonly store: KeyValueStore) {}

  /** Counts one hit for `subject`; throws RateLimitError once the rule's limit is exceeded. */
  async consume(rule: RateLimitRule, subject: string): Promise<void> {
    const { count, resetInSeconds } = await this.store.increment(
      `ratelimit:${rule.name}:${subject}`,
      rule.windowSeconds,
    );
    if (count > rule.limit) {
      throw new RateLimitError(resetInSeconds);
    }
  }
}

/**
 * Middleware applying a rule per subject. The default subject is the client IP
 * (correct behind a proxy because `trust proxy` is configured). Returning undefined skips the check.
 */
export function rateLimit(
  limiter: RateLimiter,
  rule: RateLimitRule,
  subjectOf: (req: Request) => string | undefined = (req) => req.ip,
): RequestHandler {
  return async (req, _res, next) => {
    const subject = subjectOf(req);
    if (subject) await limiter.consume(rule, subject);
    next();
  };
}
