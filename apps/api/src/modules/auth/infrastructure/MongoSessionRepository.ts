import { Schema, type Connection, type Types } from 'mongoose';
import type { TransactionContext } from '../../../core/persistence/UnitOfWork';
import {
  MongoRepository,
  modelFor,
  type VersionedDocument,
} from '../../../infrastructure/database/MongoRepository';
import { fromObjectId, toObjectId } from '../../../infrastructure/database/objectIds';
import { collectionOptions, defineSchema } from '../../../infrastructure/database/schemas';
import { Session, type SessionEndReason } from '../domain/Session';
import type { SessionRepository } from '../domain/SessionRepository';

interface SessionDocument extends VersionedDocument {
  userId: Types.ObjectId;
  familyId: Types.ObjectId;
  tokenHash: string;
  createdAt: Date;
  expiresAt: Date;
  endedAt: Date | null;
  endReason: SessionEndReason | null;
  replacedById: Types.ObjectId | null;
  userAgent: string | null;
  ip: string | null;
}

const END_REASONS: SessionEndReason[] = [
  'ROTATED',
  'LOGOUT',
  'REUSE_DETECTED',
  'PASSWORD_CHANGED',
  'ACCOUNT_INACTIVE',
];

const sessionSchema = defineSchema(
  {
    userId: { type: Schema.Types.ObjectId, required: true },
    familyId: { type: Schema.Types.ObjectId, required: true },
    tokenHash: { type: String, required: true },
    createdAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true },
    endedAt: { type: Date, default: null },
    endReason: { type: String, enum: [...END_REASONS, null], default: null },
    replacedById: { type: Schema.Types.ObjectId, default: null },
    userAgent: { type: String, default: null },
    ip: { type: String, default: null },
    version: { type: Number, required: true },
  },
  collectionOptions('sessions'),
);
sessionSchema.index({ tokenHash: 1 }, { unique: true, name: 'uniq_token_hash' });
sessionSchema.index({ familyId: 1 }, { name: 'by_family' });
sessionSchema.index({ userId: 1, endedAt: 1 }, { name: 'by_user' });
// MongoDB deletes sessions automatically once they expire.
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0, name: 'ttl_expires_at' });

export class MongoSessionRepository
  extends MongoRepository<Session, SessionDocument>
  implements SessionRepository
{
  constructor(connection: Connection) {
    super(modelFor(connection, 'Session', sessionSchema));
  }

  findByTokenHash(tokenHash: string, tx?: TransactionContext): Promise<Session | null> {
    return this.findOne({ tokenHash }, tx);
  }

  async hasActiveInFamily(familyId: string, now: Date): Promise<boolean> {
    const active = await this.model.exists({
      familyId: toObjectId(familyId),
      endedAt: null,
      expiresAt: { $gt: now },
    });
    return active !== null;
  }

  async endFamily(familyId: string, reason: SessionEndReason, now: Date): Promise<number> {
    return this.endMany({ familyId: toObjectId(familyId) }, reason, now);
  }

  async endAllForUser(userId: string, reason: SessionEndReason, now: Date): Promise<number> {
    return this.endMany({ userId: toObjectId(userId) }, reason, now);
  }

  private async endMany(
    filter: Record<string, unknown>,
    reason: SessionEndReason,
    now: Date,
  ): Promise<number> {
    const result = await this.model.updateMany(
      { ...filter, endedAt: null },
      { $set: { endedAt: now, endReason: reason }, $inc: { version: 1 } },
    );
    return result.modifiedCount;
  }

  protected toEntity(doc: SessionDocument): Session {
    return Session.restore({
      id: fromObjectId(doc._id),
      userId: fromObjectId(doc.userId),
      familyId: fromObjectId(doc.familyId),
      tokenHash: doc.tokenHash,
      createdAt: doc.createdAt,
      expiresAt: doc.expiresAt,
      endedAt: doc.endedAt ?? null,
      endReason: doc.endReason ?? null,
      replacedById: doc.replacedById ? fromObjectId(doc.replacedById) : null,
      userAgent: doc.userAgent ?? null,
      ip: doc.ip ?? null,
      version: doc.version,
    });
  }

  protected toDocument(session: Session): Omit<SessionDocument, 'version'> {
    return {
      _id: toObjectId(session.id),
      userId: toObjectId(session.userId),
      familyId: toObjectId(session.familyId),
      tokenHash: session.tokenHash,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
      endedAt: session.endedAt,
      endReason: session.endReason,
      replacedById: session.replacedById ? toObjectId(session.replacedById) : null,
      userAgent: session.userAgent,
      ip: session.ip,
    };
  }
}
