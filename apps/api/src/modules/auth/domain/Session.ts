import { AggregateRoot } from '../../../core/domain/AggregateRoot';

export type SessionEndReason =
  'ROTATED' | 'LOGOUT' | 'REUSE_DETECTED' | 'PASSWORD_CHANGED' | 'ACCOUNT_INACTIVE';

export interface SessionProps {
  id: string;
  userId: string;
  /** All sessions created by rotating one login share a family; theft revokes the whole family. */
  familyId: string;
  /** SHA-256 of the refresh token. The token itself is never stored. */
  tokenHash: string;
  createdAt: Date;
  expiresAt: Date;
  endedAt: Date | null;
  endReason: SessionEndReason | null;
  replacedById: string | null;
  userAgent: string | null;
  ip: string | null;
  version: number;
}

/** One signed-in device. Each refresh replaces the session with a new one (rotation). */
export class Session extends AggregateRoot {
  private constructor(private props: SessionProps) {
    super(props.id, props.version);
  }

  static start(input: {
    id: string;
    userId: string;
    familyId?: string;
    tokenHash: string;
    now: Date;
    ttlSeconds: number;
    userAgent: string | null;
    ip: string | null;
  }): Session {
    return new Session({
      id: input.id,
      userId: input.userId,
      familyId: input.familyId ?? input.id,
      tokenHash: input.tokenHash,
      createdAt: input.now,
      expiresAt: new Date(input.now.getTime() + input.ttlSeconds * 1000),
      endedAt: null,
      endReason: null,
      replacedById: null,
      userAgent: input.userAgent,
      ip: input.ip,
      version: 0,
    });
  }

  static restore(props: SessionProps): Session {
    return new Session(props);
  }

  get userId() {
    return this.props.userId;
  }
  get familyId() {
    return this.props.familyId;
  }
  get tokenHash() {
    return this.props.tokenHash;
  }
  get createdAt() {
    return this.props.createdAt;
  }
  get expiresAt() {
    return this.props.expiresAt;
  }
  get endedAt() {
    return this.props.endedAt;
  }
  get endReason() {
    return this.props.endReason;
  }
  get replacedById() {
    return this.props.replacedById;
  }
  get userAgent() {
    return this.props.userAgent;
  }
  get ip() {
    return this.props.ip;
  }

  get isEnded(): boolean {
    return this.props.endedAt !== null;
  }

  isExpired(now: Date): boolean {
    return now.getTime() >= this.props.expiresAt.getTime();
  }

  /**
   * True if this session was rotated only moments ago. A second refresh with the same token
   * shortly after is usually two browser tabs racing, not theft, so it is not punished.
   */
  wasRotatedWithin(seconds: number, now: Date): boolean {
    return (
      this.props.endReason === 'ROTATED' &&
      this.props.endedAt !== null &&
      now.getTime() - this.props.endedAt.getTime() <= seconds * 1000
    );
  }

  rotateTo(next: Session, now: Date): void {
    this.end('ROTATED', now);
    this.props.replacedById = next.id;
  }

  end(reason: SessionEndReason, now: Date): void {
    if (this.isEnded) return;
    this.props.endedAt = now;
    this.props.endReason = reason;
  }
}
