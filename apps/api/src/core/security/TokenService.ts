import type { OtpPurpose, Role } from '@ru-lost-found/shared';

/** What an access token proves about its bearer. */
export interface AccessTokenClaims {
  userId: string;
  universityId: string;
  role: Role;
}

/**
 * Issued after a one-time code is verified. It proves the holder controls `email`
 * for a limited time, so the next step (register / reset password) doesn't need the code again.
 */
export interface VerificationClaims {
  email: string;
  purpose: OtpPurpose;
  /**
   * For password resets: a fingerprint of the password hash at the time the token was issued.
   * Once the password changes the fingerprint no longer matches, so the token is single-use.
   */
  passwordFingerprint?: string;
}

export interface TokenService {
  issueAccessToken(claims: AccessTokenClaims): { token: string; expiresInSeconds: number };
  /** Throws UnauthorizedError if the token is malformed, tampered with or expired. */
  verifyAccessToken(token: string): AccessTokenClaims;

  issueVerificationToken(claims: VerificationClaims): string;
  /** Throws UnauthorizedError unless the token is valid and was issued for `purpose`. */
  verifyVerificationToken(token: string, purpose: OtpPurpose): VerificationClaims;
}
