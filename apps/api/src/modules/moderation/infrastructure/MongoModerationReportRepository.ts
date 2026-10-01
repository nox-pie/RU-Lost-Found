import {
  REPORT_REASONS,
  REPORT_STATUSES,
  type ReportReason,
  type ReportStatus,
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
  type DocumentFilter,
  type OutboxWriter,
  type VersionedDocument,
} from '../../../infrastructure/database/MongoRepository';
import {
  fromObjectId,
  parseObjectId,
  toObjectId,
} from '../../../infrastructure/database/objectIds';
import { collectionOptions, defineSchema } from '../../../infrastructure/database/schemas';
import { ModerationReport } from '../domain/ModerationReport';
import type { ModerationReportRepository } from '../domain/ModerationReportRepository';

interface ModerationReportDocument extends VersionedDocument {
  universityId: Types.ObjectId;
  itemId: Types.ObjectId;
  flaggedBy: Types.ObjectId;
  reason: ReportReason;
  details: string | null;
  status: ReportStatus;
  resolvedBy: Types.ObjectId | null;
  resolvedAt: Date | null;
  resolutionNote: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const reportSchema = defineSchema(
  {
    universityId: { type: Schema.Types.ObjectId, required: true },
    itemId: { type: Schema.Types.ObjectId, required: true },
    flaggedBy: { type: Schema.Types.ObjectId, required: true },
    reason: { type: String, enum: REPORT_REASONS, required: true },
    details: { type: String, default: null },
    status: { type: String, enum: REPORT_STATUSES, required: true },
    resolvedBy: { type: Schema.Types.ObjectId, default: null },
    resolvedAt: { type: Date, default: null },
    resolutionNote: { type: String, default: null },
    createdAt: { type: Date, required: true },
    updatedAt: { type: Date, required: true },
    version: { type: Number, required: true },
  },
  collectionOptions('moderation_reports'),
);
// One report per person per post, so nobody can pile up reports against a post alone.
reportSchema.index({ itemId: 1, flaggedBy: 1 }, { unique: true, name: 'uniq_item_flagger' });
// Review queue: a university's open (or decided) reports, newest first.
reportSchema.index(
  { universityId: 1, status: 1, createdAt: -1, _id: -1 },
  { name: 'review_queue' },
);

const OPEN: ReportStatus[] = ['OPEN'];
const DECIDED: ReportStatus[] = ['DISMISSED', 'ACTIONED'];

export class MongoModerationReportRepository
  extends MongoRepository<ModerationReport, ModerationReportDocument>
  implements ModerationReportRepository
{
  constructor(connection: Connection, outbox?: OutboxWriter) {
    super(modelFor(connection, 'ModerationReport', reportSchema), outbox);
  }

  findOpenForItem(
    scope: TenantScope,
    itemId: string,
    tx?: TransactionContext,
  ): Promise<ModerationReport[]> {
    const _id = parseObjectId(itemId);
    if (!_id) return Promise.resolve([]);
    return this.findMany(
      { universityId: toObjectId(scope.universityId), itemId: _id, status: 'OPEN' },
      { tx },
    );
  }

  async list(
    scope: TenantScope,
    open: boolean,
    page: PageRequest,
  ): Promise<PageResult<ModerationReport>> {
    const filter: DocumentFilter = {
      universityId: toObjectId(scope.universityId),
      status: { $in: open ? OPEN : DECIDED },
    };
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

  countOpen(scope: TenantScope): Promise<number> {
    return this.model
      .countDocuments({ universityId: toObjectId(scope.universityId), status: 'OPEN' })
      .exec();
  }

  protected override duplicateKeyMessage(): string {
    return 'You have already reported this post. An admin will look at it.';
  }

  protected toEntity(doc: ModerationReportDocument): ModerationReport {
    return ModerationReport.restore({
      id: fromObjectId(doc._id),
      universityId: fromObjectId(doc.universityId),
      itemId: fromObjectId(doc.itemId),
      flaggedBy: fromObjectId(doc.flaggedBy),
      reason: doc.reason,
      details: doc.details ?? null,
      status: doc.status,
      resolvedBy: doc.resolvedBy ? fromObjectId(doc.resolvedBy) : null,
      resolvedAt: doc.resolvedAt ?? null,
      resolutionNote: doc.resolutionNote ?? null,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      version: doc.version,
    });
  }

  protected toDocument(report: ModerationReport): Omit<ModerationReportDocument, 'version'> {
    return {
      _id: toObjectId(report.id),
      universityId: toObjectId(report.universityId),
      itemId: toObjectId(report.itemId),
      flaggedBy: toObjectId(report.flaggedBy),
      reason: report.reason,
      details: report.details,
      status: report.status,
      resolvedBy: report.resolvedBy ? toObjectId(report.resolvedBy) : null,
      resolvedAt: report.resolvedAt,
      resolutionNote: report.resolutionNote,
      createdAt: report.createdAt,
      updatedAt: report.updatedAt,
    };
  }
}
