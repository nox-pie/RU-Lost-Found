import { createHash, randomBytes } from 'node:crypto';
import type { AuditTrail } from '../../core/audit/AuditTrail';
import type { Clock } from '../../core/domain/Clock';
import type { IdGenerator } from '../../core/domain/IdGenerator';
import { ConcurrencyError, UnauthorizedError } from '../../core/errors/AppError';
import type { Logger } from '../../core/logger/logger';
import type { UnitOfWork } from '../../core/persistence/UnitOfWork';
import { Session, type SessionEndReason } from './domain/Session';
import type { SessionRepository } from './domain/SessionRepository';

const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;
/** Two tabs refreshing with the same token within this window is treated as a race, not theft. */
const ROTATION_GRACE_SECONDS = 30;

export interface ClientInfo {
  userAgent: string | null;
  ip: string | null;
}

export interface IssuedRefreshToken {
  userId: string;
  refreshToken: string;
  expiresAt: Date;
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Refresh-token sessions with rotation and reuse detection.
 *
 * Every refresh ends the current session and starts a new one in the same family. If an
 * already-rotated token is presented again (outside the short grace window), someone is
 * replaying a stolen token, so the whole family is ended and both parties must sign in again.
 */
export class SessionManager {
  constructor(
    private readonly sessions: SessionRepository,
    private readonly unitOfWork: UnitOfWork,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
    private readonly logger: Logger,
    private readonly audit: AuditTrail,
  ) {}

  async start(userId: string, client: ClientInfo): Promise<IssuedRefreshToken> {
    const { session, refreshToken } = this.newSession(userId, client);
    await this.sessions.create(session);
    return { userId, refreshToken, expiresAt: session.expiresAt };
  }

  async rotate(refreshToken: string, client: ClientInfo): Promise<IssuedRefreshToken> {
    const now = this.clock.now();
    const current = await this.sessions.findByTokenHash(hashToken(refreshToken));
    if (!current) throw new UnauthorizedError('Your session has ended. Please sign in again.');

    if (current.isEnded) {
      // Only a *rotated* token coming back means it was copied (theft). Tokens ended by sign-out,
      // a password change or a suspension are just refused.
      if (
        current.endReason === 'ROTATED' &&
        !current.wasRotatedWithin(ROTATION_GRACE_SECONDS, now)
      ) {
        const ended = await this.sessions.endFamily(current.familyId, 'REUSE_DETECTED', now);
        this.logger.warn(
          { userId: current.userId, familyId: current.familyId, ended },
          'Refresh token reuse detected; ended the session family',
        );
        await this.audit.recordSafely({
          action: 'SESSION_REUSE_DETECTED',
          actorId: null,
          universityId: null,
          targetType: 'SESSION',
          targetId: current.familyId,
          occurredAt: now,
          metadata: { userId: current.userId, sessionsEnded: ended },
          ip: client.ip,
        });
      }
      throw new UnauthorizedError('Your session has ended. Please sign in again.');
    }
    if (current.isExpired(now)) {
      throw new UnauthorizedError('Your session has expired. Please sign in again.');
    }

    const { session: next, refreshToken: nextToken } = this.newSession(
      current.userId,
      client,
      current.familyId,
    );
    current.rotateTo(next, now);

    try {
      await this.unitOfWork.run(async (tx) => {
        await this.sessions.create(next, tx);
        await this.sessions.update(current, tx);
      });
    } catch (error) {
      // Another request rotated the same token first.
      if (error instanceof ConcurrencyError) {
        throw new UnauthorizedError('Your session was refreshed elsewhere. Please try again.');
      }
      throw error;
    }

    return { userId: current.userId, refreshToken: nextToken, expiresAt: next.expiresAt };
  }

  /**
   * Signs out one device: ends every session of the token's family (the chain of rotations
   * since that sign-in) in one atomic update. Unlike saving the single session, this can't
   * clash with a refresh running at the same moment, and it also ends a token that such a
   * refresh has just issued. Unknown tokens are ignored.
   */
  async end(refreshToken: string): Promise<void> {
    const session = await this.sessions.findByTokenHash(hashToken(refreshToken));
    if (!session) return;
    await this.sessions.endFamily(session.familyId, 'LOGOUT', this.clock.now());
  }

  /** Signs out every device of a user. */
  async endAll(userId: string, reason: SessionEndReason): Promise<void> {
    await this.sessions.endAllForUser(userId, reason, this.clock.now());
  }

  private newSession(userId: string, client: ClientInfo, familyId?: string) {
    const refreshToken = randomBytes(32).toString('base64url');
    const session = Session.start({
      id: this.ids.next(),
      userId,
      familyId,
      tokenHash: hashToken(refreshToken),
      now: this.clock.now(),
      ttlSeconds: REFRESH_TOKEN_TTL_SECONDS,
      userAgent: client.userAgent?.slice(0, 300) ?? null,
      ip: client.ip,
    });
    return { session, refreshToken };
  }
}
