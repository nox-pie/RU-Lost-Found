import { Router, type Request } from 'express';
import {
  loginSchema,
  registerSchema,
  requestOtpSchema,
  resetPasswordSchema,
  verifyOtpSchema,
} from '@ru-lost-found/shared';
import { requireTrustedOrigin } from '../../core/http/middleware/security';
import { validate } from '../../core/http/middleware/validate';
import { rateLimit, type RateLimiter, type RateLimitRule } from '../../core/http/rateLimit';
import type { AuthController } from './auth.controller';

const HOUR = 60 * 60;
const MINUTE = 60;

/**
 * Per-IP limits are generous because a whole campus can share one public IP address (NAT);
 * the tight limits are per email (code requests) and per account (failed logins, LoginThrottle).
 */
export const AUTH_RATE_LIMITS = {
  otpPerIp: { name: 'otp-ip', limit: 60, windowSeconds: HOUR },
  otpPerEmail: { name: 'otp-email', limit: 5, windowSeconds: HOUR },
  verifyPerIp: { name: 'verify-ip', limit: 120, windowSeconds: 10 * MINUTE },
  registerPerIp: { name: 'register-ip', limit: 60, windowSeconds: HOUR },
  loginPerIp: { name: 'login-ip', limit: 120, windowSeconds: 15 * MINUTE },
  refreshPerIp: { name: 'refresh-ip', limit: 300, windowSeconds: MINUTE },
  resetPerIp: { name: 'reset-ip', limit: 30, windowSeconds: HOUR },
} satisfies Record<string, RateLimitRule>;

const emailOf = (req: Request) => (req.body as { email?: string }).email;

export function createAuthRouter(
  controller: AuthController,
  limiter: RateLimiter,
  trustedOrigins: readonly string[],
): Router {
  const router = Router();
  const sameSiteOnly = requireTrustedOrigin(trustedOrigins);
  const limits = AUTH_RATE_LIMITS;

  router.post(
    '/otp',
    validate({ body: requestOtpSchema }),
    rateLimit(limiter, limits.otpPerIp),
    rateLimit(limiter, limits.otpPerEmail, emailOf),
    controller.requestOtp,
  );
  router.post(
    '/otp/verify',
    validate({ body: verifyOtpSchema }),
    rateLimit(limiter, limits.verifyPerIp),
    controller.verifyOtp,
  );
  router.post(
    '/register',
    validate({ body: registerSchema }),
    rateLimit(limiter, limits.registerPerIp),
    controller.register,
  );
  router.post(
    '/login',
    validate({ body: loginSchema }),
    rateLimit(limiter, limits.loginPerIp),
    controller.login,
  );
  router.post(
    '/refresh',
    sameSiteOnly,
    rateLimit(limiter, limits.refreshPerIp),
    controller.refresh,
  );
  router.post('/logout', sameSiteOnly, controller.logout);
  router.post(
    '/password/reset',
    validate({ body: resetPasswordSchema }),
    rateLimit(limiter, limits.resetPerIp),
    controller.resetPassword,
  );

  return router;
}
