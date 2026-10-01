import type { ModerationDecision, ReportReason, ReportStatus } from '@ru-lost-found/shared';
import { AggregateRoot } from '../../../core/domain/AggregateRoot';
import { isModerator, type Actor } from '../../../core/domain/Actor';
import { ForbiddenError, InvalidStateTransitionError } from '../../../core/errors/AppError';

export interface ModerationReportProps {
  id: string;
  universityId: string;
  itemId: string;
  /** The person who flagged the post (not the post's reporter). */
  flaggedBy: string;
  reason: ReportReason;
  details: string | null;
  status: ReportStatus;
  resolvedBy: string | null;
  resolvedAt: Date | null;
  resolutionNote: string | null;
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

/**
 * Someone's complaint about a post. It stays OPEN until an admin decides: keep the post
 * (DISMISSED) or remove it (ACTIONED). Every open report on a post is decided together.
 */
export class ModerationReport extends AggregateRoot {
  private constructor(private props: ModerationReportProps) {
    super(props.id, props.version);
  }

  static file(input: {
    id: string;
    universityId: string;
    item: { id: string; reporterId: string };
    flaggedBy: string;
    reason: ReportReason;
    details?: string;
    now: Date;
  }): ModerationReport {
    if (input.item.reporterId === input.flaggedBy) {
      throw new ForbiddenError('You can’t report your own post. Remove it instead.');
    }
    const report = new ModerationReport({
      id: input.id,
      universityId: input.universityId,
      itemId: input.item.id,
      flaggedBy: input.flaggedBy,
      reason: input.reason,
      details: input.details?.trim() || null,
      status: 'OPEN',
      resolvedBy: null,
      resolvedAt: null,
      resolutionNote: null,
      createdAt: input.now,
      updatedAt: input.now,
      version: 0,
    });
    report.record({
      type: 'ItemFlagged',
      aggregateId: report.id,
      occurredAt: input.now,
      payload: {
        universityId: report.universityId,
        itemId: report.itemId,
        actorId: report.flaggedBy,
        reason: report.reason,
      },
    });
    return report;
  }

  static restore(props: ModerationReportProps): ModerationReport {
    return new ModerationReport(props);
  }

  get universityId() {
    return this.props.universityId;
  }
  get itemId() {
    return this.props.itemId;
  }
  get flaggedBy() {
    return this.props.flaggedBy;
  }
  get reason() {
    return this.props.reason;
  }
  get details() {
    return this.props.details;
  }
  get status() {
    return this.props.status;
  }
  get resolvedBy() {
    return this.props.resolvedBy;
  }
  get resolvedAt() {
    return this.props.resolvedAt;
  }
  get resolutionNote() {
    return this.props.resolutionNote;
  }
  get createdAt() {
    return this.props.createdAt;
  }
  get updatedAt() {
    return this.props.updatedAt;
  }

  resolve(decision: ModerationDecision, by: Actor, note: string | null, now: Date): void {
    if (!isModerator(by)) {
      throw new ForbiddenError('Only admins can decide on reports.');
    }
    if (this.props.status !== 'OPEN') {
      throw new InvalidStateTransitionError('This report has already been decided.');
    }
    this.props.status = decision === 'REMOVE_ITEM' ? 'ACTIONED' : 'DISMISSED';
    this.props.resolvedBy = by.userId;
    this.props.resolvedAt = now;
    this.props.resolutionNote = note?.trim() || null;
    this.props.updatedAt = now;
    this.record({
      type: 'ReportResolved',
      aggregateId: this.id,
      occurredAt: now,
      payload: {
        universityId: this.universityId,
        itemId: this.itemId,
        actorId: by.userId,
        decision,
      },
    });
  }
}
