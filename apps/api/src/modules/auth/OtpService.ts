import { createHmac, timingSafeEqual } from 'node:crypto';
import type { OtpPurpose } from '@ru-lost-found/shared';
import type { KeyValueStore } from '../../core/cache/KeyValueStore';
import { RateLimitError, ValidationError } from '../../core/errors/AppError';
import { generateNumericCode } from '../../core/security/randomCode';

const OTP_TTL_SECONDS = 10 * 60;
export const OTP_MAX_ATTEMPTS = 5;
const OTP_RESEND_COOLDOWN_SECONDS = 60;
/**
 * Wrong codes allowed per email per day, across all codes. Requesting a new code resets the
 * per-code limit but not this one, so guessing can't be sped up by asking for fresh codes.
 */
export const OTP_MAX_DAILY_FAILURES = 10;
const DAY_SECONDS = 24 * 60 * 60;

/**
 * One-time 6-digit codes sent by email.
 *
 * - Only an HMAC of the code is stored, keyed with a server secret, so a leaked store reveals nothing.
 * - A code expires after 10 minutes, allows 5 guesses, and is deleted once used.
 * - A new code for the same email can be requested once a minute.
 */
export class OtpService {
  constructor(
    private readonly store: KeyValueStore,
    private readonly secret: Buffer,
    private readonly generateCode: () => string = () => generateNumericCode(6),
  ) {}

  /** Enforces the resend cooldown without issuing a code (used when no email will be sent). */
  async throttle(purpose: OtpPurpose, email: string): Promise<void> {
    const { count, resetInSeconds } = await this.store.increment(
      this.key('otp-cooldown', purpose, email),
      OTP_RESEND_COOLDOWN_SECONDS,
    );
    if (count > 1) {
      throw new RateLimitError(
        resetInSeconds,
        'Please wait a minute before requesting another code.',
      );
    }
  }

  /** Creates a new code, replacing any previous one. Returns it so the caller can email it. */
  async issue(purpose: OtpPurpose, email: string): Promise<string> {
    await this.throttle(purpose, email);
    const code = this.generateCode();
    await this.store.delete(this.key('otp-attempts', purpose, email));
    await this.store.set(
      this.key('otp', purpose, email),
      this.hash(purpose, email, code),
      OTP_TTL_SECONDS,
    );
    return code;
  }

  /** Succeeds once per code. Throws ValidationError for a wrong, expired or exhausted code. */
  async verify(purpose: OtpPurpose, email: string, code: string): Promise<void> {
    const codeKey = this.key('otp', purpose, email);
    const attemptsKey = this.key('otp-attempts', purpose, email);
    const failuresKey = this.key('otp-failures', purpose, email);

    if (Number((await this.store.get(failuresKey)) ?? 0) >= OTP_MAX_DAILY_FAILURES) {
      throw new RateLimitError(
        DAY_SECONDS,
        'Too many incorrect codes for this email today. Please try again tomorrow.',
      );
    }

    const { count } = await this.store.increment(attemptsKey, OTP_TTL_SECONDS);
    if (count > OTP_MAX_ATTEMPTS) {
      await this.store.delete(codeKey);
      throw new ValidationError('Too many incorrect attempts. Please request a new code.');
    }

    const stored = await this.store.get(codeKey);
    if (!stored || !this.matches(stored, this.hash(purpose, email, code))) {
      await this.store.increment(failuresKey, DAY_SECONDS);
      throw new ValidationError('The code is incorrect or has expired.');
    }

    await this.store.delete(codeKey, attemptsKey);
  }

  private hash(purpose: OtpPurpose, email: string, code: string): string {
    return createHmac('sha256', this.secret).update(`${purpose}:${email}:${code}`).digest('hex');
  }

  private matches(a: string, b: string): boolean {
    const left = Buffer.from(a);
    const right = Buffer.from(b);
    return left.length === right.length && timingSafeEqual(left, right);
  }

  private key(kind: string, purpose: OtpPurpose, email: string): string {
    return `${kind}:${purpose}:${email}`;
  }
}
