import type { RequestHandler } from 'express';
import helmet from 'helmet';
import { ForbiddenError } from '../../errors/AppError';
import { rateLimit, type RateLimiter, type RateLimitRule } from '../rateLimit';

/**
 * Security headers for a JSON-only API. Pages are served by the web app (which sets its own
 * content security policy), so the API forbids everything a browser could do with its responses.
 */
export function securityHeaders(): RequestHandler {
  return helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: { 'default-src': ["'none'"], 'frame-ancestors': ["'none'"] },
    },
    crossOriginResourcePolicy: { policy: 'same-site' },
    referrerPolicy: { policy: 'no-referrer' },
  });
}

/** API responses contain personal data: never store them in browser or proxy caches. */
export const noStore: RequestHandler = (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
};

/**
 * Second line of defence against CSRF on endpoints authenticated by a cookie (refresh, logout),
 * on top of SameSite=Lax: a browser always sends `Origin` on cross-site POSTs, so a request from
 * a site that isn't ours is refused. Requests without `Origin` (non-browser clients) pass.
 */
export function requireTrustedOrigin(trustedOrigins: readonly string[]): RequestHandler {
  return (req, _res, next) => {
    const origin = req.get('origin');
    if (origin && !trustedOrigins.includes(origin)) {
      throw new ForbiddenError('Requests from this site are not allowed.');
    }
    next();
  };
}

export const WRITE_RATE_LIMIT: RateLimitRule = { name: 'writes-ip', limit: 120, windowSeconds: 60 };

/**
 * A general per-IP cap on requests that change data. Reads are not counted: each check costs a
 * Redis command, and on the free tier those are metered, while reads are already bounded by
 * pagination limits. Endpoint-specific limits (login, codes, reports) still apply on top.
 */
export function limitWrites(limiter: RateLimiter): RequestHandler {
  const limited = rateLimit(limiter, WRITE_RATE_LIMIT);
  return (req, res, next) => {
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
      next();
      return;
    }
    return limited(req, res, next);
  };
}
