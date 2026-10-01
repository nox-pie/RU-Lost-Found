import type { Request, RequestHandler } from 'express';
import type { Role } from '@ru-lost-found/shared';
import type { Actor } from '../domain/Actor';
import type { TenantScope } from '../persistence/Repository';
import { ForbiddenError, UnauthorizedError } from '../errors/AppError';
import type { AccessTokenClaims, TokenService } from '../security/TokenService';

export type AuthContext = AccessTokenClaims;

declare module 'express-serve-static-core' {
  interface Request {
    /** Set by `authenticate` for requests with a valid access token. */
    auth?: AuthContext;
  }
}

/**
 * Requires a valid `Authorization: Bearer <access token>` header and exposes its claims as `req.auth`.
 * The token is verified without a database lookup; it lives for 15 minutes, so a suspension takes
 * effect at the latest when the client next refreshes its session.
 */
export function authenticate(tokens: TokenService): RequestHandler {
  return (req, _res, next) => {
    const header = req.headers.authorization;
    const match = header ? /^Bearer (\S+)$/i.exec(header) : null;
    if (!match?.[1]) {
      throw new UnauthorizedError();
    }
    req.auth = tokens.verifyAccessToken(match[1]);
    next();
  };
}

/** Allows only the given roles. Must run after `authenticate`. */
export function authorize(...roles: Role[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.auth) throw new UnauthorizedError();
    if (!roles.includes(req.auth.role)) throw new ForbiddenError();
    next();
  };
}

/** Reads a user's current role and status (the composition root passes the user repository). */
export type AccountLookup = (
  userId: string,
) => Promise<{ role: Role; isActive: boolean; universityId: string } | null>;

/**
 * Like `authorize`, but checks the role and status stored now instead of trusting the token,
 * which can be up to 15 minutes old. Used for admin routes: a demoted or suspended admin loses
 * access at once, for the price of one indexed lookup on rarely used endpoints.
 */
export function authorizeCurrent(lookup: AccountLookup, ...roles: Role[]): RequestHandler {
  return async (req, _res, next) => {
    const auth = authOf(req);
    const account = await lookup(auth.userId);
    if (!account || !account.isActive || account.universityId !== auth.universityId) {
      throw new UnauthorizedError('Your session has ended. Please sign in again.');
    }
    if (!roles.includes(account.role)) throw new ForbiddenError();
    req.auth = { ...auth, role: account.role };
    next();
  };
}

/** The authenticated user of a request that passed `authenticate`. */
export function authOf(req: Request): AuthContext {
  if (!req.auth) throw new UnauthorizedError();
  return req.auth;
}

export function actorOf(req: Request): Actor {
  const { userId, role } = authOf(req);
  return { userId, role };
}

export function scopeOf(req: Request): TenantScope {
  return { universityId: authOf(req).universityId };
}
