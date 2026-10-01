import {
  ITEM_CATEGORIES,
  ITEM_STATUSES,
  ITEM_TYPES,
  type ItemCategory,
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
import { Item, type VerificationQuestion } from '../domain/Item';
import type { ItemRepository, ItemSearchCriteria } from '../domain/ItemRepository';

interface ItemDocument extends VersionedDocument {
  universityId: Types.ObjectId;
  reporterId: Types.ObjectId;
  type: ItemType;
  category: ItemCategory;
  title: string;
  description: string;
  location: string;
  occurredOn: Date;
  images: ImageRef[];
  verificationQuestions: VerificationQuestion[];
  heldAtSecurityDesk: boolean;
  status: ItemStatus;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt: Date | null;
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
    version: { type: Number, required: true },
  },
  collectionOptions('items'),
);
// Feed: newest items of a university, optionally filtered by status/type (cursor on createdAt + _id).
itemSchema.index({ universityId: 1, status: 1, type: 1, createdAt: -1, _id: -1 }, { name: 'feed' });
itemSchema.index({ universityId: 1, reporterId: 1, createdAt: -1 }, { name: 'by_reporter' });
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

  findRemovedWithPhotos(before: Date, limit: number): Promise<Item[]> {
    return this.findMany(
      { status: 'REMOVED', updatedAt: { $lt: before }, 'images.0': { $exists: true } },
      { sort: { updatedAt: 1 }, limit },
    );
  }

  async search(
    scope: TenantScope,
    criteria: ItemSearchCriteria,
    page: PageRequest,
  ): Promise<PageResult<Item>> {
    const filter: DocumentFilter = {
      universityId: toObjectId(scope.universityId),
      status: { $in: criteria.statuses },
    };
    if (criteria.type) filter.type = criteria.type;
    if (criteria.category) filter.category = criteria.category;
    if (criteria.reporterId) filter.reporterId = toObjectId(criteria.reporterId);
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
      occurredOn: item.occurredOn,
      images: [...item.images],
      verificationQuestions: [...item.verificationQuestions],
      heldAtSecurityDesk: item.heldAtSecurityDesk,
      status: item.status,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      resolvedAt: item.resolvedAt,
    };
  }
}
