import { createHash } from 'node:crypto';
import type {
  LoginInput,
  RegisterInput,
  RequestOtpInput,
  ResetPasswordInput,
  VerifyOtpInput,
  VerifyOtpResponse,
} from '@ru-lost-found/shared';
import type { AuditTrail } from '../../core/audit/AuditTrail';
import type { Clock } from '../../core/domain/Clock';
import type { IdGenerator } from '../../core/domain/IdGenerator';
import type { EmailMessage, EmailSender } from '../../core/email/EmailSender';
import {
  ConflictError,
  ForbiddenError,
  UnauthorizedError,
  ValidationError,
} from '../../core/errors/AppError';
import type { Logger } from '../../core/logger/logger';
import type { PasswordHasher } from '../../core/security/PasswordHasher';
import type { TokenService } from '../../core/security/TokenService';
import type { UniversityRepository } from '../universities/domain/UniversityRepository';
import { User, normalizeEmail } from '../users/domain/User';
import type { AdminAccounts } from '../users/AdminAccounts';
import type { UserRepository } from '../users/domain/UserRepository';
import type { AuthEmails } from './auth.emails';
import type { LoginThrottle } from './LoginThrottle';
import type { OtpService } from './OtpService';
import type { ClientInfo, SessionManager } from './SessionManager';

export interface AuthResult {
  user: User;
  accessToken: string;
  accessTokenExpiresIn: number;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
}

export interface AuthServiceDeps {
  users: UserRepository;
  universities: UniversityRepository;
  otp: OtpService;
  sessions: SessionManager;
  tokens: TokenService;
  passwords: PasswordHasher;
  email: EmailSender;
  emails: AuthEmails;
  ids: IdGenerator;
  clock: Clock;
  audit: AuditTrail;
  loginThrottle: LoginThrottle;
  logger: Logger;
  adminAccounts: AdminAccounts;
}

const INVALID_CREDENTIALS = 'Incorrect email or password.';

/** Changes whenever the password hash changes; binds a reset token to one password. */
function passwordFingerprint(passwordHash: string): string {
  return createHash('sha256').update(passwordHash).digest('hex').slice(0, 16);
}

/**
 * Sign-up, sign-in, session refresh and password reset.
 *
 * Sign-up and reset are two steps: prove you own the email with a one-time code
 * (→ short-lived verification token), then register or set a new password with that token.
 */
export class AuthService {
  private dummyHash?: Promise<string>;

  constructor(private readonly deps: AuthServiceDeps) {}

  /**
   * Always answers the same way for a given purpose, whether or not the email has an account,
   * so the endpoint can't be used to discover registered emails. Emails are sent in the
   * background: waiting for the email provider only when an account exists would make the
   * response measurably slower for registered emails (a timing leak).
   */
  async requestOtp({ email, purpose }: RequestOtpInput): Promise<void> {
    const { otp, users, universities, emails } = this.deps;

    if (purpose === 'SIGNUP') {
      const university = await universities.findByEmail(email);
      if (!university) {
        throw new ValidationError('Please use your university email address.');
      }
      const existing = await users.findByEmail(email);
      if (existing) {
        await otp.throttle(purpose, email);
        this.sendInBackground(emails.accountAlreadyExists(email, existing.profile.firstName));
        return;
      }
      const code = await otp.issue(purpose, email);
      this.sendInBackground(emails.signupCode(email, code));
      return;
    }

    const user = await users.findByEmail(email);
    if (!user || !user.isActive) {
      await otp.throttle(purpose, email);
      return;
    }
    const code = await otp.issue(purpose, email);
    this.sendInBackground(emails.passwordResetCode(email, user.profile.firstName, code));
  }

  private sendInBackground(message: EmailMessage): void {
    this.deps.email.send(message).catch((err: unknown) => {
      this.deps.logger.error({ err, subject: message.subject }, 'Could not send email');
    });
  }

  async verifyOtp({ email, purpose, code }: VerifyOtpInput): Promise<VerifyOtpResponse> {
    const { otp, tokens, users, universities } = this.deps;
    await otp.verify(purpose, email, code);

    if (purpose === 'SIGNUP') {
      const university = await universities.findByEmail(email);
      if (!university) throw new ValidationError('Please use your university email address.');
      return {
        verificationToken: tokens.issueVerificationToken({ email, purpose }),
        expiresIn: 30 * 60,
        university: { id: university.id, name: university.name, schools: [...university.schools] },
      };
    }

    const user = await users.findByEmail(email);
    if (!user) throw new ValidationError('The code is incorrect or has expired.');
    return {
      verificationToken: tokens.issueVerificationToken({
        email,
        purpose,
        passwordFingerprint: passwordFingerprint(user.passwordHash),
      }),
      expiresIn: 30 * 60,
    };
  }

  async register(input: RegisterInput, client: ClientInfo): Promise<AuthResult> {
    const { tokens, universities, users, passwords, ids, clock } = this.deps;
    const { email } = tokens.verifyVerificationToken(input.verificationToken, 'SIGNUP');

    const university = await universities.findByEmail(email);
    if (!university) throw new ValidationError('Please use your university email address.');
    if (university.schools.length > 0 && !university.hasSchool(input.school)) {
      throw new ValidationError('The request is invalid.', [
        { path: 'body.school', message: `Choose a school of ${university.name}` },
      ]);
    }
    if (await users.findByEmail(email)) {
      throw new ConflictError('An account with this email already exists. Please sign in.');
    }

    const user = User.register({
      id: ids.next(),
      universityId: university.id,
      email,
      passwordHash: await passwords.hash(input.password),
      profile: {
        firstName: input.firstName,
        lastName: input.lastName,
        year: input.year,
        school: input.school,
        enrollmentNumber: input.enrollmentNumber,
        phone: input.phone ?? null,
      },
      now: clock.now(),
    });
    this.deps.adminAccounts.applyTo(user);
    await users.create(user);

    return this.signIn(user, client);
  }

  async login({ email, password }: LoginInput, client: ClientInfo): Promise<AuthResult> {
    await this.deps.loginThrottle.assertAllowed(email, client.ip);
    const user = await this.deps.users.findByEmail(email);

    // Hash even when the user doesn't exist, so response time doesn't reveal registered emails.
    const valid = await this.deps.passwords.verify(
      password,
      user?.passwordHash ?? (await this.getDummyHash()),
    );
    const failure = !user
      ? 'UNKNOWN_EMAIL'
      : !valid
        ? 'WRONG_PASSWORD'
        : !user.isActive
          ? 'SUSPENDED'
          : null;
    await this.deps.audit.recordSafely({
      action: failure ? 'LOGIN_FAILED' : 'LOGIN_SUCCEEDED',
      actorId: failure ? null : (user?.id ?? null),
      universityId: user?.universityId ?? null,
      targetType: 'USER',
      targetId: user?.id ?? null,
      occurredAt: this.deps.clock.now(),
      metadata: failure ? { reason: failure } : {},
      ip: client.ip,
    });

    if (!user || !valid) {
      await this.deps.loginThrottle.recordFailure(email, client.ip);
      throw new UnauthorizedError(INVALID_CREDENTIALS);
    }
    if (!user.isActive) {
      throw new ForbiddenError(
        'Your account has been suspended. Please contact the administrators.',
      );
    }

    return this.signIn(user, client);
  }

  /** Exchanges a refresh token for a new access token and a new refresh token. */
  async refresh(refreshToken: string, client: ClientInfo): Promise<AuthResult> {
    const issued = await this.deps.sessions.rotate(refreshToken, client);
    const user = await this.deps.users.findById(issued.userId);
    if (!user || !user.isActive) {
      await this.deps.sessions.endAll(issued.userId, 'ACCOUNT_INACTIVE');
      throw new UnauthorizedError('Your session has ended. Please sign in again.');
    }

    const access = this.deps.tokens.issueAccessToken({
      userId: user.id,
      universityId: user.universityId,
      role: user.role,
    });
    return {
      user,
      accessToken: access.token,
      accessTokenExpiresIn: access.expiresInSeconds,
      refreshToken: issued.refreshToken,
      refreshTokenExpiresAt: issued.expiresAt,
    };
  }

  async logout(refreshToken: string | undefined): Promise<void> {
    if (refreshToken) await this.deps.sessions.end(refreshToken);
  }

  /** Sets a new password and signs the user out on every device. */
  async resetPassword({ verificationToken, newPassword }: ResetPasswordInput): Promise<void> {
    const { tokens, users, passwords, sessions, clock } = this.deps;
    const claims = tokens.verifyVerificationToken(verificationToken, 'PASSWORD_RESET');

    const user = await users.findByEmail(normalizeEmail(claims.email));
    if (!user || claims.passwordFingerprint !== passwordFingerprint(user.passwordHash)) {
      throw new UnauthorizedError('This reset has already been used. Please request a new code.');
    }

    user.changePassword(await passwords.hash(newPassword), clock.now());
    await users.update(user);
    await sessions.endAll(user.id, 'PASSWORD_CHANGED');
  }

  private async signIn(user: User, client: ClientInfo): Promise<AuthResult> {
    const issued = await this.deps.sessions.start(user.id, client);
    const access = this.deps.tokens.issueAccessToken({
      userId: user.id,
      universityId: user.universityId,
      role: user.role,
    });
    return {
      user,
      accessToken: access.token,
      accessTokenExpiresIn: access.expiresInSeconds,
      refreshToken: issued.refreshToken,
      refreshTokenExpiresAt: issued.expiresAt,
    };
  }

  private getDummyHash(): Promise<string> {
    this.dummyHash ??= this.deps.passwords.hash('timing-equaliser-not-a-real-password');
    return this.dummyHash;
  }
}
