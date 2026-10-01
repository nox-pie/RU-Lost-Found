import { describe, expect, it } from 'vitest';
import { UnauthorizedError } from '../../core/errors/AppError';
import { FixedClock } from '../../testing/builders';
import { JwtTokenService } from './JwtTokenService';
import { deriveKey } from './keys';

const secret = 'x'.repeat(40);
const keys = {
  access: deriveKey(secret, 'access-token'),
  verification: deriveKey(secret, 'verification-token'),
};
const claims = { userId: 'u1', universityId: 'uni1', role: 'STUDENT' as const };

describe('JwtTokenService', () => {
  const tokens = new JwtTokenService(keys, new FixedClock());

  it('round-trips access token claims', () => {
    const { token, expiresInSeconds } = tokens.issueAccessToken(claims);

    expect(tokens.verifyAccessToken(token)).toEqual(claims);
    expect(expiresInSeconds).toBe(900);
  });

  it('never accepts one kind of token as the other', () => {
    const access = tokens.issueAccessToken(claims).token;
    const verification = tokens.issueVerificationToken({ email: 'a@b.in', purpose: 'SIGNUP' });

    expect(() => tokens.verifyAccessToken(verification)).toThrow(UnauthorizedError);
    expect(() => tokens.verifyVerificationToken(access, 'SIGNUP')).toThrow(UnauthorizedError);
    expect(() => tokens.verifyVerificationToken(verification, 'PASSWORD_RESET')).toThrow(
      UnauthorizedError,
    );
  });

  it('rejects tokens signed with another secret', () => {
    const other = new JwtTokenService(
      {
        access: deriveKey('y'.repeat(40), 'access-token'),
        verification: deriveKey('y'.repeat(40), 'verification-token'),
      },
      new FixedClock(),
    );

    expect(() => tokens.verifyAccessToken(other.issueAccessToken(claims).token)).toThrow(
      UnauthorizedError,
    );
  });

  it('derives different keys for different purposes', () => {
    expect(keys.access.equals(keys.verification)).toBe(false);
    expect(deriveKey(secret, 'access-token').equals(keys.access)).toBe(true);
  });
});
