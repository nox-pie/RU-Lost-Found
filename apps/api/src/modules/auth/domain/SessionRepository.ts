import type { Repository } from '../../../core/persistence/Repository';
import type { TransactionContext } from '../../../core/persistence/UnitOfWork';
import type { Session, SessionEndReason } from './Session';

export interface SessionRepository extends Repository<Session> {
  findByTokenHash(tokenHash: string, tx?: TransactionContext): Promise<Session | null>;
  /** True while the family (one sign-in on one device) still has an unexpired, active session. */
  hasActiveInFamily(familyId: string, now: Date): Promise<boolean>;
  /** Ends every still-active session in a family. Returns how many were ended. */
  endFamily(familyId: string, reason: SessionEndReason, now: Date): Promise<number>;
  /** Ends every still-active session of a user (sign out everywhere). */
  endAllForUser(userId: string, reason: SessionEndReason, now: Date): Promise<number>;
}
