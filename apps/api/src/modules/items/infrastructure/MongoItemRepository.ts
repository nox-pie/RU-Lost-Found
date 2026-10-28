import {
  ITEM_CATEGORIES,
  ITEM_CLOSE_REASONS,
  ITEM_STATUSES,
  ITEM_TYPES,
  LISTABLE_ITEM_STATUSES,
  type ItemCategory,
  type ItemCloseReason,
  type ItemStatus,
  type ItemType,
} from '@ru-lost-found/shared';
import { Schema, type Connection, type Types } from 'mongoose';
import type { ImageRef } from '../../../core/domain/ImageRef';
import {
  decodeCursor,
  toPage,
  type PageRequest,
  type PageResult,
} from '../../../core/persistence/Pagination';
import type { TenantScope } from '../../../core/persistence/Repository';
import type { TransactionContext } from '../../../core/persistence/UnitOfWork';
import {
  MongoRepository,
  modelFor,
  type OutboxWriter,
  type DocumentFilter,
  type VersionedDocument,
} from '../../../infrastructure/database/MongoRepository';
import {
  fromObjectId,
  parseObjectId,
  toObjectId,
} from '../../../infrastructure/database/objectIds';
import {
  collectionOptions,
  defineSchema,
  imageRefSchema,
  subdocumentOptions,
} from '../../../infrastructure/database/schemas';
import { Item, OPEN_FOR_DAYS, type VerificationQuestion } from '../domain/Item';
import type {
  FeedCriteria,
  ItemRepository,
  ItemSearchCriteria,
  ItemTally,
} from '../domain/ItemRepository';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The place and day-range part of a browse filter, the same for the list and the counts. Both
 * `occurredOn` and the bounds are midnight UTC, so the range includes both whole days.
 */
function placeAndDays(criteria: Pick<FeedCriteria, 'place' | 'occurredFrom' | 'occurredTo'>) {
  const filter: DocumentFilter = {};
  if (criteria.place) filter.place = criteria.place;
  if (criteria.occurredFrom || criteria.occurredTo) {
    filter.occurredOn = {
      ...(criteria.occurredFrom && { $gte: criteria.occurredFrom }),
      ...(criteria.occurredTo && { $lte: criteria.occurredTo }),
    };
  }
  return filter;
}

interface ItemDocument extends VersionedDocument {
  universityId: Types.ObjectId;
  reporterId: Types.ObjectId;
  type: ItemType;
  category: ItemCategory;
  title: string;
  description: string;
  location: string;
  place?: string | null;
  occurredOn: Date;
  images: ImageRef[];
  verificationQuestions: VerificationQuestion[];
  heldAtSecurityDesk: boolean;
  status: ItemStatus;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt: Date | null;
  closeReason?: ItemCloseReason | null;
  /** Absent on posts saved before expiry existed: they count from createdAt. */
  expiresAt?: Date;
  expiryRemindedAt?: Date | null;
}

const itemSchema = defineSchema(
  {
    universityId: { type: Schema.Types.ObjectId, required: true },
    reporterId: { type: Schema.Types.ObjectId, required: true },
    type: { type: String, enum: ITEM_TYPES, required: true },
    category: { type: String, enum: ITEM_CATEGORIES, required: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    location: { type: String, required: true },
    place: { type: String, default: null },
    occurredOn: { type: Date, required: true },
    images: { type: [imageRefSchema], required: true },
    verificationQuestions: {
      type: [
        defineSchema(
          { id: { type: String, required: true }, question: { type: String, required: true } },
          subdocumentOptions,
        ),
      ],
      default: [],
    },
    heldAtSecurityDesk: { type: Boolean, required: true },
    status: { type: String, enum: ITEM_STATUSES, required: true },
    createdAt: { type: Date, required: true },
    updatedAt: { type: Date, required: true },
    resolvedAt: { type: Date, default: null },
    closeReason: { type: String, enum: ITEM_CLOSE_REASONS, default: null },
    expiresAt: { type: Date },
    expiryRemindedAt: { type: Date, default: null },
    version: { type: Number, required: true },
  },
  collectionOptions('items'),
);
// Feed: newest items of a university, optionally filtered by status/type (cursor on createdAt + _id).
itemSchema.index({ universityId: 1, status: 1, type: 1, createdAt: -1, _id: -1 }, { name: 'feed' });
itemSchema.index({ universityId: 1, reporterId: 1, createdAt: -1 }, { name: 'by_reporter' });
// The job that reminds reporters and closes posts nobody kept open, across universities.
itemSchema.index({ status: 1, expiresAt: 1 }, { name: 'by_expiry' });
itemSchema.index(
  { title: 'text', location: 'text', description: 'text' },
  { name: 'text_search', weights: { title: 5, location: 3, description: 1 } },
);

export class MongoItemRepository
  extends MongoRepository<Item, ItemDocument>
  implements ItemRepository
{
  constructor(connection: Connection, outbox?: OutboxWriter) {
    super(modelFor(connection, 'Item', itemSchema), outbox);
  }

  findById(scope: TenantScope, id: string, tx?: TransactionContext): Promise<Item | null> {
    const _id = parseObjectId(id);
    if (!_id) return Promise.resolve(null);
    return this.findOne({ _id, universityId: toObjectId(scope.universityId) }, tx);
  }

  findByIds(scope: TenantScope, ids: readonly string[]): Promise<Item[]> {
    const objectIds = [...new Set(ids)].map(parseObjectId).filter((id) => id !== null);
    if (objectIds.length === 0) return Promise.resolve([]);
    return this.findMany({ universityId: toObjectId(scope.universityId), _id: { $in: objectIds } });
  }

  findMatchCandidates(
    scope: TenantScope,
    criteria: {
      type: ItemType;
      category: ItemCategory;
      occurredFrom: Date;
      occurredTo: Date;
      excludeReporterId: string;
    },
    limit: number,
  ): Promise<Item[]> {
    return this.findMany(
      {
        universityId: toObjectId(scope.universityId),
        status: 'OPEN',
        type: criteria.type,
        category: criteria.category,
        occurredOn: { $gte: criteria.occurredFrom, $lte: criteria.occurredTo },
        reporterId: { $ne: toObjectId(criteria.excludeReporterId) },
      },
      { sort: { createdAt: -1, _id: -1 }, limit },
    );
  }

  findOpenNeedingReminder(expiringBy: Date, limit: number): Promise<Item[]> {
    return this.findMany(
      {
        status: 'OPEN',
        expiryRemindedAt: null,
        $or: [
          { expiresAt: { $lte: expiringBy } },
          // Saved before expiry existed: open for OPEN_FOR_DAYS from when it was posted.
          {
            expiresAt: { $exists: false },
            createdAt: { $lte: new Date(expiringBy.getTime() - OPEN_FOR_DAYS * DAY_MS) },
          },
        ],
      },
      { sort: { createdAt: 1 }, limit },
    );
  }

  findOpenToClose(expiredBy: Date, remindedBy: Date, limit: number): Promise<Item[]> {
    return this.findMany(
      {
        status: 'OPEN',
        expiresAt: { $lte: expiredBy },
        expiryRemindedAt: { $ne: null, $lte: remindedBy },
      },
      { sort: { expiresAt: 1 }, limit },
    );
  }

  findRemovedWithPhotos(before: Date, limit: number): Promise<Item[]> {
    return this.findMany(
      { status: 'REMOVED', updatedAt: { $lt: before }, 'images.0': { $exists: true } },
      { sort: { updatedAt: 1 }, limit },
    );
  }

  async tally(scope: TenantScope, criteria: FeedCriteria): Promise<ItemTally[]> {
    const match: DocumentFilter = {
      universityId: toObjectId(scope.universityId),
      status: { $in: [...LISTABLE_ITEM_STATUSES] },
      ...placeAndDays(criteria),
    };
    if (criteria.category) match.category = criteria.category;
    // A $text match must be the first stage of the pipeline.
    if (criteria.text) match.$text = { $search: criteria.text };
    const rows = await this.model.aggregate<{
      _id: { type: ItemType; status: ItemStatus };
      count: number;
    }>([
      { $match: match },
      { $group: { _id: { type: '$type', status: '$status' }, count: { $sum: 1 } } },
    ]);
    return rows.map((row) => ({ type: row._id.type, status: row._id.status, count: row.count }));
  }

  async search(
    scope: TenantScope,
    criteria: ItemSearchCriteria,
    page: PageRequest,
  ): Promise<PageResult<Item>> {
    const filter: DocumentFilter = {
      universityId: toObjectId(scope.universityId),
      status: { $in: criteria.statuses },
      ...placeAndDays(criteria),
    };
    if (criteria.type) filter.type = criteria.type;
    if (criteria.category) filter.category = criteria.category;
    if (criteria.reporterId) filter.reporterId = toObjectId(criteria.reporterId);
    if (criteria.heldAtSecurityDesk !== undefined) {
      filter.heldAtSecurityDesk = criteria.heldAtSecurityDesk;
    }
    // Word search on the text index (stemmed: "keys" also matches "key").
    if (criteria.text) filter.$text = { $search: criteria.text };
    if (page.cursor) {
      const after = decodeCursor(page.cursor);
      filter.$or = [
        { createdAt: { $lt: after.createdAt } },
        { createdAt: after.createdAt, _id: { $lt: toObjectId(after.id) } },
      ];
    }

    const rows = await this.findMany(filter, {
      sort: { createdAt: -1, _id: -1 },
      limit: page.limit + 1,
    });
    return toPage(rows, page.limit);
  }

  protected toEntity(doc: ItemDocument): Item {
    return Item.restore({
      id: fromObjectId(doc._id),
      universityId: fromObjectId(doc.universityId),
      reporterId: fromObjectId(doc.reporterId),
      type: doc.type,
      category: doc.category,
      title: doc.title,
      description: doc.description,
      location: doc.location,
      place: doc.place ?? null,
      occurredOn: doc.occurredOn,
      images: doc.images.map((i) => ({ url: i.url, publicId: i.publicId })),
      verificationQuestions: doc.verificationQuestions.map((q) => ({
        id: q.id,
        question: q.question,
      })),
      heldAtSecurityDesk: doc.heldAtSecurityDesk,
      status: doc.status,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      resolvedAt: doc.resolvedAt ?? null,
      closeReason: doc.closeReason ?? null,
      expiresAt: doc.expiresAt ?? new Date(doc.createdAt.getTime() + OPEN_FOR_DAYS * DAY_MS),
      expiryRemindedAt: doc.expiryRemindedAt ?? null,
      version: doc.version,
    });
  }

  protected toDocument(item: Item): Omit<ItemDocument, 'version'> {
    return {
      _id: toObjectId(item.id),
      universityId: toObjectId(item.universityId),
      reporterId: toObjectId(item.reporterId),
      type: item.type,
      category: item.category,
      title: item.title,
      description: item.description,
      location: item.location,
      place: item.place,
      occurredOn: item.occurredOn,
      images: [...item.images],
      verificationQuestions: [...item.verificationQuestions],
      heldAtSecurityDesk: item.heldAtSecurityDesk,
      status: item.status,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      resolvedAt: item.resolvedAt,
      closeReason: item.closeReason,
      expiresAt: item.expiresAt,
      expiryRemindedAt: item.expiryRemindedAt,
    };
  }
}
