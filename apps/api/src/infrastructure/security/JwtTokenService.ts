import { OTP_PURPOSES, ROLES, type OtpPurpose } from '@ru-lost-found/shared';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { type Clock, SystemClock } from '../../core/domain/Clock';
import { UnauthorizedError } from '../../core/errors/AppError';
import type {
  AccessTokenClaims,
  TokenService,
  VerificationClaims,
} from '../../core/security/TokenService';

const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
const VERIFICATION_TOKEN_TTL_SECONDS = 30 * 60;

const ISSUER = 'ru-lost-found';
const ACCESS_AUDIENCE = 'api';
const VERIFICATION_AUDIENCE = 'verification';

const accessPayload = z.object({
  sub: z.string(),
  uid: z.string(),
  role: z.enum(ROLES),
});

const verificationPayload = z.object({
  sub: z.string(),
  purpose: z.enum(OTP_PURPOSES),
  pwd: z.string().optional(),
});

/**
 * Signed JWTs (HS256). Access and verification tokens use different keys and audiences,
 * so one kind can never be accepted as the other.
 */
export class JwtTokenService implements TokenService {
  constructor(
    private readonly keys: { access: Buffer; verification: Buffer },
    private readonly clock: Clock = new SystemClock(),
  ) {}

  issueAccessToken(claims: AccessTokenClaims): { token: string; expiresInSeconds: number } {
    const token = jwt.sign(
      { sub: claims.userId, uid: claims.universityId, role: claims.role, iat: this.nowSeconds() },
      this.keys.access,
      {
        algorithm: 'HS256',
        issuer: ISSUER,
        audience: ACCESS_AUDIENCE,
        expiresIn: ACCESS_TOKEN_TTL_SECONDS,
      },
    );
    return { token, expiresInSeconds: ACCESS_TOKEN_TTL_SECONDS };
  }

  verifyAccessToken(token: string): AccessTokenClaims {
    const payload = accessPayload.safeParse(this.verify(token, this.keys.access, ACCESS_AUDIENCE));
    if (!payload.success) {
      throw new UnauthorizedError('Your session is invalid. Please sign in again.');
    }
    return { userId: payload.data.sub, universityId: payload.data.uid, role: payload.data.role };
  }

  issueVerificationToken(claims: VerificationClaims): string {
    return jwt.sign(
      {
        sub: claims.email,
        purpose: claims.purpose,
        ...(claims.passwordFingerprint ? { pwd: claims.passwordFingerprint } : {}),
        iat: this.nowSeconds(),
      },
      this.keys.verification,
      {
        algorithm: 'HS256',
        issuer: ISSUER,
        audience: VERIFICATION_AUDIENCE,
        expiresIn: VERIFICATION_TOKEN_TTL_SECONDS,
      },
    );
  }

  verifyVerificationToken(token: string, purpose: OtpPurpose): VerificationClaims {
    const payload = verificationPayload.safeParse(
      this.verify(token, this.keys.verification, VERIFICATION_AUDIENCE),
    );
    if (!payload.success || payload.data.purpose !== purpose) {
      throw new UnauthorizedError('This verification has expired. Please request a new code.');
    }
    return {
      email: payload.data.sub,
      purpose: payload.data.purpose,
      ...(payload.data.pwd ? { passwordFingerprint: payload.data.pwd } : {}),
    };
  }

  private verify(token: string, key: Buffer, audience: string): unknown {
    try {
      return jwt.verify(token, key, {
        algorithms: ['HS256'],
        issuer: ISSUER,
        audience,
        clockTimestamp: this.nowSeconds(),
      });
    } catch {
      throw new UnauthorizedError('Your session has expired. Please sign in again.');
    }
  }

  private nowSeconds(): number {
    return Math.floor(this.clock.now().getTime() / 1000);
  }
}
