import { NOTIFICATION_TYPES, type NotificationType } from '@ru-lost-found/shared';
import { Schema, type Connection, type Types } from 'mongoose';
import { ConflictError } from '../../../core/errors/AppError';
import {
  decodeCursor,
  toPage,
  type PageRequest,
  type PageResult,
} from '../../../core/persistence/Pagination';
import {
  MongoRepository,
  modelFor,
  type DocumentFilter,
  type VersionedDocument,
} from '../../../infrastructure/database/MongoRepository';
import {
  fromObjectId,
  parseObjectId,
  toObjectId,
} from '../../../infrastructure/database/objectIds';
import { collectionOptions, defineSchema } from '../../../infrastructure/database/schemas';
import { Notification } from '../domain/Notification';
import type { NotificationRepository } from '../domain/NotificationRepository';

interface NotificationDocument extends VersionedDocument {
  userId: Types.ObjectId;
  universityId: Types.ObjectId;
  type: NotificationType;
  title: string;
  body: string;
  claimId: Types.ObjectId | null;
  itemId: Types.ObjectId | null;
  sourceEventId: string;
  readAt: Date | null;
  createdAt: Date;
}

const RETENTION_SECONDS = 180 * 24 * 60 * 60;

const notificationSchema = defineSchema(
  {
    userId: { type: Schema.Types.ObjectId, required: true },
    universityId: { type: Schema.Types.ObjectId, required: true },
    type: { type: String, enum: NOTIFICATION_TYPES, required: true },
    title: { type: String, required: true },
    body: { type: String, required: true },
    claimId: { type: Schema.Types.ObjectId, default: null },
    itemId: { type: Schema.Types.ObjectId, default: null },
    sourceEventId: { type: String, required: true },
    readAt: { type: Date, default: null },
    createdAt: { type: Date, required: true },
    version: { type: Number, required: true },
  },
  collectionOptions('notifications'),
);
notificationSchema.index({ userId: 1, createdAt: -1, _id: -1 }, { name: 'by_user' });
notificationSchema.index({ userId: 1, readAt: 1 }, { name: 'unread_by_user' });
notificationSchema.index(
  { sourceEventId: 1, userId: 1 },
  { unique: true, name: 'uniq_event_recipient' },
);
// Old notifications are deleted automatically after six months.
notificationSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: RETENTION_SECONDS, name: 'ttl_created_at' },
);

export class MongoNotificationRepository
  extends MongoRepository<Notification, NotificationDocument>
  implements NotificationRepository
{
  constructor(connection: Connection) {
    super(modelFor(connection, 'Notification', notificationSchema));
  }

  async add(notification: Notification): Promise<boolean> {
    try {
      await this.create(notification);
      return true;
    } catch (error) {
      if (error instanceof ConflictError) return false;
      throw error;
    }
  }

  async listForUser(
    userId: string,
    filter: { unreadOnly: boolean },
    page: PageRequest,
  ): Promise<PageResult<Notification>> {
    const query: DocumentFilter = { userId: toObjectId(userId) };
    if (filter.unreadOnly) query.readAt = null;
    if (page.cursor) {
      const after = decodeCursor(page.cursor);
      query.$or = [
        { createdAt: { $lt: after.createdAt } },
        { createdAt: after.createdAt, _id: { $lt: toObjectId(after.id) } },
      ];
    }
    const rows = await this.findMany(query, {
      sort: { createdAt: -1, _id: -1 },
      limit: page.limit + 1,
    });
    return toPage(rows, page.limit);
  }

  countUnread(userId: string): Promise<number> {
    return this.model.countDocuments({ userId: toObjectId(userId), readAt: null });
  }

  async markRead(userId: string, ids: readonly string[] | undefined, now: Date): Promise<number> {
    const filter: DocumentFilter = { userId: toObjectId(userId), readAt: null };
    if (ids) filter._id = { $in: ids.map(parseObjectId).filter((id) => id !== null) };
    const result = await this.model.updateMany(filter, {
      $set: { readAt: now },
      $inc: { version: 1 },
    });
    return result.modifiedCount;
  }

  protected toEntity(doc: NotificationDocument): Notification {
    return Notification.restore({
      id: fromObjectId(doc._id),
      userId: fromObjectId(doc.userId),
      universityId: fromObjectId(doc.universityId),
      type: doc.type,
      title: doc.title,
      body: doc.body,
      claimId: doc.claimId ? fromObjectId(doc.claimId) : null,
      itemId: doc.itemId ? fromObjectId(doc.itemId) : null,
      sourceEventId: doc.sourceEventId,
      readAt: doc.readAt ?? null,
      createdAt: doc.createdAt,
      version: doc.version,
    });
  }

  protected toDocument(notification: Notification): Omit<NotificationDocument, 'version'> {
    return {
      _id: toObjectId(notification.id),
      userId: toObjectId(notification.userId),
      universityId: toObjectId(notification.universityId),
      type: notification.type,
      title: notification.title,
      body: notification.body,
      claimId: notification.claimId ? toObjectId(notification.claimId) : null,
      itemId: notification.itemId ? toObjectId(notification.itemId) : null,
      sourceEventId: notification.sourceEventId,
      readAt: notification.readAt,
      createdAt: notification.createdAt,
    };
  }
}
