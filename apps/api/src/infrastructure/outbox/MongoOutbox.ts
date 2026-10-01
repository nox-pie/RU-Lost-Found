import { Schema, type ClientSession, type Connection, type Types } from 'mongoose';
import type { DomainEvent } from '../../core/events/DomainEvent';
import type { StoredEvent } from '../../core/events/EventHandler';
import { modelFor } from '../database/MongoRepository';
import { fromObjectId } from '../database/objectIds';
import { collectionOptions, defineSchema } from '../database/schemas';

export type OutboxStatus = 'PENDING' | 'PROCESSING' | 'DONE' | 'FAILED';

interface OutboxDocument {
  _id: Types.ObjectId;
  type: string;
  aggregateId: string;
  occurredAt: Date;
  payload: Record<string, unknown>;
  status: OutboxStatus;
  attempts: number;
  /** Not processed before this time (used for retry back-off). */
  availableAt: Date;
  /** While PROCESSING: after this time the event is considered abandoned and picked up again. */
  lockedUntil: Date | null;
  /** Handlers that already succeeded, so a retry only re-runs the ones that failed. */
  completedHandlers: string[];
  lastError: string | null;
  processedAt: Date | null;
}

export interface ClaimedEvent extends StoredEvent {
  attempts: number;
  completedHandlers: string[];
}

const outboxSchema = defineSchema(
  {
    type: { type: String, required: true },
    aggregateId: { type: String, required: true },
    occurredAt: { type: Date, required: true },
    payload: { type: Schema.Types.Mixed, default: {} },
    status: {
      type: String,
      enum: ['PENDING', 'PROCESSING', 'DONE', 'FAILED'],
      required: true,
    },
    attempts: { type: Number, required: true },
    availableAt: { type: Date, required: true },
    lockedUntil: { type: Date, default: null },
    completedHandlers: { type: [String], default: [] },
    lastError: { type: String, default: null },
    processedAt: { type: Date, default: null },
  },
  { ...collectionOptions('outbox_events'), minimize: false },
);
outboxSchema.index({ status: 1, availableAt: 1 }, { name: 'ready' });
outboxSchema.index({ status: 1, lockedUntil: 1 }, { name: 'abandoned' });
outboxSchema.index({ status: 1, processedAt: 1 }, { name: 'processed' });

/**
 * Transactional outbox. Events are inserted in the same MongoDB transaction as the change that
 * produced them; a background processor later claims and delivers them. This replaces a message
 * broker: delivery is guaranteed (at least once) without extra infrastructure.
 */
export class MongoOutbox {
  private readonly model;

  constructor(connection: Connection) {
    this.model = modelFor(connection, 'OutboxEvent', outboxSchema);
  }

  async ensureIndexes(): Promise<void> {
    await this.model.createCollection();
    await this.model.syncIndexes();
  }

  /** Stores events inside the caller's session (the aggregate's transaction). */
  async append(events: readonly DomainEvent[], session: ClientSession | undefined): Promise<void> {
    if (events.length === 0) return;
    await this.model.insertMany(
      events.map((event) => ({
        type: event.type,
        aggregateId: event.aggregateId,
        occurredAt: event.occurredAt,
        payload: event.payload,
        status: 'PENDING',
        attempts: 0,
        availableAt: event.occurredAt,
        lockedUntil: null,
        completedHandlers: [],
        lastError: null,
        processedAt: null,
      })),
      { session },
    );
  }

  /**
   * Atomically takes the next ready event (or one whose processor died mid-way) and locks it
   * for `leaseSeconds`. Safe with several worker instances: each event goes to exactly one.
   */
  async claimNext(now: Date, leaseSeconds: number): Promise<ClaimedEvent | null> {
    const doc = await this.model
      .findOneAndUpdate(
        {
          $or: [
            { status: 'PENDING', availableAt: { $lte: now } },
            { status: 'PROCESSING', lockedUntil: { $lt: now } },
          ],
        },
        {
          $set: {
            status: 'PROCESSING',
            lockedUntil: new Date(now.getTime() + leaseSeconds * 1000),
          },
          $inc: { attempts: 1 },
        },
        { sort: { availableAt: 1, _id: 1 }, returnDocument: 'after' },
      )
      .lean()
      .exec();
    if (!doc) return null;
    const event = doc as unknown as OutboxDocument;
    return {
      id: fromObjectId(event._id),
      type: event.type,
      aggregateId: event.aggregateId,
      occurredAt: event.occurredAt,
      payload: event.payload ?? {},
      attempts: event.attempts,
      completedHandlers: event.completedHandlers ?? [],
    };
  }

  async markHandlerDone(eventId: string, handlerName: string): Promise<void> {
    await this.model.updateOne({ _id: eventId }, { $addToSet: { completedHandlers: handlerName } });
  }

  async complete(eventId: string, now: Date): Promise<void> {
    await this.model.updateOne(
      { _id: eventId },
      { $set: { status: 'DONE', processedAt: now, lockedUntil: null, lastError: null } },
    );
  }

  async retryLater(eventId: string, availableAt: Date, error: string): Promise<void> {
    await this.model.updateOne(
      { _id: eventId },
      { $set: { status: 'PENDING', availableAt, lockedUntil: null, lastError: error } },
    );
  }

  async fail(eventId: string, now: Date, error: string): Promise<void> {
    await this.model.updateOne(
      { _id: eventId },
      { $set: { status: 'FAILED', processedAt: now, lockedUntil: null, lastError: error } },
    );
  }

  /** Housekeeping: delivered events are only kept for a while (for debugging). */
  async deleteDoneBefore(cutoff: Date): Promise<number> {
    const result = await this.model.deleteMany({ status: 'DONE', processedAt: { $lt: cutoff } });
    return result.deletedCount;
  }

  async countByStatus(status: OutboxStatus): Promise<number> {
    return this.model.countDocuments({ status });
  }
}
