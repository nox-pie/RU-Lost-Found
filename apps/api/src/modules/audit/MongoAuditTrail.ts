import {
  AUDIT_ACTIONS,
  AUDIT_TARGET_TYPES,
  type AuditAction,
  type AuditTargetType,
} from '@ru-lost-found/shared';
import { Schema, mongo, type Connection } from 'mongoose';
import type {
  AuditEntry,
  AuditLog,
  AuditLogFilter,
  AuditRecord,
  AuditTrail,
} from '../../core/audit/AuditTrail';
import type { Logger } from '../../core/logger/logger';
import {
  decodeCursor,
  encodeCursor,
  type PageRequest,
  type PageResult,
} from '../../core/persistence/Pagination';
import type { TenantScope } from '../../core/persistence/Repository';
import { modelFor } from '../../infrastructure/database/MongoRepository';
import { parseObjectId, toObjectId } from '../../infrastructure/database/objectIds';
import { collectionOptions, defineSchema } from '../../infrastructure/database/schemas';

const RETENTION_SECONDS = 365 * 24 * 60 * 60;

const auditSchema = defineSchema(
  {
    action: { type: String, enum: AUDIT_ACTIONS, required: true },
    actorId: { type: Schema.Types.ObjectId, default: null },
    universityId: { type: Schema.Types.ObjectId, default: null },
    targetType: { type: String, enum: AUDIT_TARGET_TYPES, required: true },
    targetId: { type: String, default: null },
    occurredAt: { type: Date, required: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
    ip: { type: String, default: null },
    sourceEventId: { type: String, default: null },
  },
  { ...collectionOptions('audit_logs'), minimize: false },
);
auditSchema.index({ universityId: 1, occurredAt: -1, _id: -1 }, { name: 'by_university' });
auditSchema.index({ actorId: 1, occurredAt: -1 }, { name: 'by_actor' });
auditSchema.index({ targetType: 1, targetId: 1, occurredAt: -1 }, { name: 'by_target' });
auditSchema.index(
  { sourceEventId: 1 },
  {
    unique: true,
    name: 'uniq_source_event',
    partialFilterExpression: { sourceEventId: { $type: 'string' } },
  },
);
auditSchema.index({ occurredAt: 1 }, { expireAfterSeconds: RETENTION_SECONDS, name: 'ttl' });

export interface AuditLogRecord {
  action: AuditAction;
  actorId: string | null;
  targetType: AuditTargetType;
  targetId: string | null;
  occurredAt: Date;
  metadata: Record<string, unknown>;
}

interface StoredAuditDocument {
  _id: { toHexString(): string };
  action: AuditAction;
  actorId: { toHexString(): string } | null;
  targetType: AuditTargetType;
  targetId: string | null;
  occurredAt: Date;
  metadata?: Record<string, unknown>;
  ip?: string | null;
}

/** Audit trail in its own collection; insert-only, one year retention. */
export class MongoAuditTrail implements AuditTrail, AuditLog {
  private readonly model;

  constructor(
    connection: Connection,
    private readonly logger: Logger,
  ) {
    this.model = modelFor(connection, 'AuditLog', auditSchema);
  }

  async ensureIndexes(): Promise<void> {
    await this.model.createCollection();
    await this.model.syncIndexes();
  }

  async record(entry: AuditEntry): Promise<void> {
    try {
      await this.model.create({
        ...entry,
        actorId: entry.actorId ? parseObjectId(entry.actorId) : null,
        universityId: entry.universityId ? parseObjectId(entry.universityId) : null,
        metadata: entry.metadata ?? {},
        ip: entry.ip ?? null,
        sourceEventId: entry.sourceEventId ?? null,
      });
    } catch (error) {
      // A redelivered event was already recorded: nothing to do.
      if (error instanceof mongo.MongoServerError && error.code === 11000) return;
      throw error;
    }
  }

  /** Newest first. Used by the admin audit view and by tests. */
  async findRecent(filter: { targetId?: string; action?: AuditAction }, limit = 50) {
    const docs = await this.model
      .find(filter, null, { sort: { occurredAt: -1, _id: -1 }, limit })
      .lean()
      .exec();
    return docs.map((doc) => {
      const d = doc as unknown as AuditLogRecord & { actorId: { toHexString(): string } | null };
      return {
        action: d.action,
        actorId: d.actorId ? d.actorId.toHexString() : null,
        targetType: d.targetType,
        targetId: d.targetId,
        occurredAt: d.occurredAt,
        metadata: d.metadata ?? {},
      } satisfies AuditLogRecord;
    });
  }

  async search(
    scope: TenantScope,
    filter: AuditLogFilter,
    page: PageRequest,
  ): Promise<PageResult<AuditRecord>> {
    const query: Record<string, unknown> = { universityId: toObjectId(scope.universityId) };
    if (filter.action) query.action = filter.action;
    if (filter.actorId) query.actorId = parseObjectId(filter.actorId);
    if (filter.targetId) query.targetId = filter.targetId;
    if (filter.from || filter.until) {
      query.occurredAt = {
        ...(filter.from ? { $gte: filter.from } : {}),
        ...(filter.until ? { $lt: filter.until } : {}),
      };
    }
    if (page.cursor) {
      const after = decodeCursor(page.cursor);
      query.$or = [
        { occurredAt: { $lt: after.createdAt } },
        { occurredAt: after.createdAt, _id: { $lt: toObjectId(after.id) } },
      ];
    }
    const docs = (await this.model
      .find(query, null, { sort: { occurredAt: -1, _id: -1 }, limit: page.limit + 1 })
      .lean()
      .exec()) as unknown as StoredAuditDocument[];

    const items = docs.slice(0, page.limit).map((d): AuditRecord => ({
      id: d._id.toHexString(),
      action: d.action,
      actorId: d.actorId ? d.actorId.toHexString() : null,
      targetType: d.targetType,
      targetId: d.targetId,
      occurredAt: d.occurredAt,
      metadata: d.metadata ?? {},
      ip: d.ip ?? null,
    }));
    const last = items.at(-1);
    return {
      items,
      nextCursor:
        docs.length > page.limit && last
          ? encodeCursor({ createdAt: last.occurredAt, id: last.id })
          : null,
    };
  }

  /** Recording must never break the action being audited; failures are logged instead. */
  async recordSafely(entry: AuditEntry): Promise<void> {
    try {
      await this.record(entry);
    } catch (err) {
      this.logger.error({ err, action: entry.action }, 'Could not write audit entry');
    }
  }
}
