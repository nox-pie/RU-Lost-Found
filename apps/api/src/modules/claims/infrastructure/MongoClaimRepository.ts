import {
  CLAIM_KINDS,
  CLAIM_STATUSES,
  type ClaimKind,
  type ClaimStatus,
} from '@ru-lost-found/shared';
import { Schema, type Connection, type Types } from 'mongoose';
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
  subdocumentOptions,
} from '../../../infrastructure/database/schemas';
import { Claim, type ClaimAnswer, type Handover } from '../domain/Claim';
import type { ClaimRepository, ClaimSearchCriteria } from '../domain/ClaimRepository';

interface ClaimHistoryDocument {
  from: ClaimStatus | null;
  to: ClaimStatus;
  byUserId: Types.ObjectId | null;
  at: Date;
  note: string | null;
}

interface ClaimDocument extends VersionedDocument {
  universityId: Types.ObjectId;
  itemId: Types.ObjectId;
  reporterId: Types.ObjectId;
  claimantId: Types.ObjectId;
  kind: ClaimKind;
  message: string;
  answers: ClaimAnswer[];
  status: ClaimStatus;
  handover: Handover | null;
  rejectionReason: string | null;
  claimantSharesPhone: boolean;
  reporterSharesPhone: boolean;
  history: ClaimHistoryDocument[];
  createdAt: Date;
  updatedAt: Date;
}

const ACTIVE_STATUSES: ClaimStatus[] = ['REQUESTED', 'APPROVED'];

const claimSchema = defineSchema(
  {
    universityId: { type: Schema.Types.ObjectId, required: true },
    itemId: { type: Schema.Types.ObjectId, required: true },
    reporterId: { type: Schema.Types.ObjectId, required: true },
    claimantId: { type: Schema.Types.ObjectId, required: true },
    kind: { type: String, enum: CLAIM_KINDS, required: true },
    message: { type: String, default: '' },
    answers: {
      type: [
        defineSchema(
          {
            questionId: { type: String, required: true },
            answer: { type: String, required: true },
          },
          subdocumentOptions,
        ),
      ],
      default: [],
    },
    status: { type: String, enum: CLAIM_STATUSES, required: true },
    handover: {
      type: defineSchema(
        {
          code: { type: String, required: true },
          deadline: { type: Date, required: true },
          failedAttempts: { type: Number, required: true },
        },
        subdocumentOptions,
      ),
      default: null,
    },
    rejectionReason: { type: String, default: null },
    claimantSharesPhone: { type: Boolean, default: false },
    reporterSharesPhone: { type: Boolean, default: false },
    history: {
      type: [
        defineSchema(
          {
            from: { type: String, enum: [...CLAIM_STATUSES, null], default: null },
            to: { type: String, enum: CLAIM_STATUSES, required: true },
            byUserId: { type: Schema.Types.ObjectId, default: null },
            at: { type: Date, required: true },
            note: { type: String, default: null },
          },
          subdocumentOptions,
        ),
      ],
      default: [],
    },
    createdAt: { type: Date, required: true },
    updatedAt: { type: Date, required: true },
    version: { type: Number, required: true },
  },
  collectionOptions('claims'),
);
claimSchema.index({ universityId: 1, itemId: 1, createdAt: 1 }, { name: 'by_item' });
claimSchema.index({ universityId: 1, claimantId: 1, createdAt: -1 }, { name: 'by_claimant' });
claimSchema.index({ universityId: 1, reporterId: 1, createdAt: -1 }, { name: 'by_reporter' });
claimSchema.index({ status: 1, 'handover.deadline': 1 }, { name: 'overdue' });
// Database-level guarantees behind the domain rules (they hold even under concurrent requests):
claimSchema.index(
  { itemId: 1, claimantId: 1 },
  {
    unique: true,
    name: 'uniq_active_claim_per_claimant',
    partialFilterExpression: { status: { $in: ACTIVE_STATUSES } },
  },
);
claimSchema.index(
  { itemId: 1 },
  {
    unique: true,
    name: 'uniq_approved_claim_per_item',
    partialFilterExpression: { status: 'APPROVED' },
  },
);

export class MongoClaimRepository
  extends MongoRepository<Claim, ClaimDocument>
  implements ClaimRepository
{
  constructor(connection: Connection, outbox?: OutboxWriter) {
    super(modelFor(connection, 'Claim', claimSchema), outbox);
  }

  findById(scope: TenantScope, id: string, tx?: TransactionContext): Promise<Claim | null> {
    const _id = parseObjectId(id);
    if (!_id) return Promise.resolve(null);
    return this.findOne({ _id, universityId: toObjectId(scope.universityId) }, tx);
  }

  findActiveByItem(scope: TenantScope, itemId: string, tx?: TransactionContext): Promise<Claim[]> {
    const itemObjectId = parseObjectId(itemId);
    if (!itemObjectId) return Promise.resolve([]);
    return this.findMany(
      {
        universityId: toObjectId(scope.universityId),
        itemId: itemObjectId,
        status: { $in: ACTIVE_STATUSES },
      },
      { sort: { createdAt: 1 }, tx },
    );
  }

  findActiveByItemAndClaimant(
    scope: TenantScope,
    itemId: string,
    claimantId: string,
    tx?: TransactionContext,
  ): Promise<Claim | null> {
    const itemObjectId = parseObjectId(itemId);
    const claimantObjectId = parseObjectId(claimantId);
    if (!itemObjectId || !claimantObjectId) return Promise.resolve(null);
    return this.findOne(
      {
        universityId: toObjectId(scope.universityId),
        itemId: itemObjectId,
        claimantId: claimantObjectId,
        status: { $in: ACTIVE_STATUSES },
      },
      tx,
    );
  }

  async search(
    scope: TenantScope,
    criteria: ClaimSearchCriteria,
    page: PageRequest,
  ): Promise<PageResult<Claim>> {
    const filter: DocumentFilter = { universityId: toObjectId(scope.universityId) };
    if (criteria.claimantId) filter.claimantId = toObjectId(criteria.claimantId);
    if (criteria.reporterId) filter.reporterId = toObjectId(criteria.reporterId);
    if (criteria.itemId) filter.itemId = toObjectId(criteria.itemId);
    if (criteria.statuses) filter.status = { $in: criteria.statuses };
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

  async wasRejectedByReporter(
    scope: TenantScope,
    itemId: string,
    claimantId: string,
  ): Promise<boolean> {
    const found = await this.model.exists({
      universityId: toObjectId(scope.universityId),
      itemId: toObjectId(itemId),
      claimantId: toObjectId(claimantId),
      status: 'REJECTED',
      // Automatic rejections (another claim was completed) are recorded without a user.
      history: { $elemMatch: { to: 'REJECTED', byUserId: { $ne: null } } },
    });
    return found !== null;
  }

  findOverdueApproved(now: Date, limit: number): Promise<Claim[]> {
    return this.findMany(
      { status: 'APPROVED', 'handover.deadline': { $lt: now } },
      { sort: { 'handover.deadline': 1 }, limit },
    );
  }

  protected override duplicateKeyMessage(indexName: string | undefined): string {
    if (indexName === 'uniq_approved_claim_per_item') {
      return 'Another claim on this item has already been approved.';
    }
    return 'You already have an active claim on this item.';
  }

  protected toEntity(doc: ClaimDocument): Claim {
    return Claim.restore({
      id: fromObjectId(doc._id),
      universityId: fromObjectId(doc.universityId),
      itemId: fromObjectId(doc.itemId),
      reporterId: fromObjectId(doc.reporterId),
      claimantId: fromObjectId(doc.claimantId),
      kind: doc.kind,
      message: doc.message,
      answers: doc.answers.map((a) => ({ questionId: a.questionId, answer: a.answer })),
      status: doc.status,
      handover: doc.handover
        ? {
            code: doc.handover.code,
            deadline: doc.handover.deadline,
            failedAttempts: doc.handover.failedAttempts,
          }
        : null,
      rejectionReason: doc.rejectionReason ?? null,
      claimantSharesPhone: doc.claimantSharesPhone ?? false,
      reporterSharesPhone: doc.reporterSharesPhone ?? false,
      history: doc.history.map((h) => ({
        from: h.from ?? null,
        to: h.to,
        byUserId: h.byUserId ? fromObjectId(h.byUserId) : null,
        at: h.at,
        note: h.note ?? null,
      })),
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      version: doc.version,
    });
  }

  protected toDocument(claim: Claim): Omit<ClaimDocument, 'version'> {
    return {
      _id: toObjectId(claim.id),
      universityId: toObjectId(claim.universityId),
      itemId: toObjectId(claim.itemId),
      reporterId: toObjectId(claim.reporterId),
      claimantId: toObjectId(claim.claimantId),
      kind: claim.kind,
      message: claim.message,
      answers: [...claim.answers],
      status: claim.status,
      handover: claim.handover ? { ...claim.handover } : null,
      rejectionReason: claim.rejectionReason,
      claimantSharesPhone: claim.claimantSharesPhone,
      reporterSharesPhone: claim.reporterSharesPhone,
      history: claim.history.map((h) => ({
        from: h.from,
        to: h.to,
        byUserId: h.byUserId ? toObjectId(h.byUserId) : null,
        at: h.at,
        note: h.note,
      })),
      createdAt: claim.createdAt,
      updatedAt: claim.updatedAt,
    };
  }
}
