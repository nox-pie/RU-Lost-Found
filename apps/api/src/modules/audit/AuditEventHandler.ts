import type { AuditAction, AuditTargetType } from '@ru-lost-found/shared';
import type { AuditTrail } from '../../core/audit/AuditTrail';
import type { EventHandler, StoredEvent } from '../../core/events/EventHandler';
import { isDomainEventType, type DomainEventType } from '../events';

type Mapping = {
  action: AuditAction;
  targetType: AuditTargetType;
  /** Payload field holding the actor; `aggregate` means the aggregate itself (e.g. the user). */
  actor: string | 'aggregate' | null;
};

const MAPPINGS = {
  UserRegistered: { action: 'USER_REGISTERED', targetType: 'USER', actor: 'aggregate' },
  PasswordChanged: { action: 'PASSWORD_CHANGED', targetType: 'USER', actor: 'aggregate' },
  AccountDeleted: { action: 'ACCOUNT_DELETED', targetType: 'USER', actor: 'aggregate' },
  ItemReported: { action: 'ITEM_REPORTED', targetType: 'ITEM', actor: 'reporterId' },
  ItemRemoved: { action: 'ITEM_REMOVED', targetType: 'ITEM', actor: 'removedBy' },
  ItemClosed: { action: 'ITEM_CLOSED', targetType: 'ITEM', actor: 'actorId' },
  ItemReopened: { action: 'ITEM_REOPENED', targetType: 'ITEM', actor: 'reporterId' },
  ClaimRequested: { action: 'CLAIM_SUBMITTED', targetType: 'CLAIM', actor: 'actorId' },
  ClaimApproved: { action: 'CLAIM_APPROVED', targetType: 'CLAIM', actor: 'actorId' },
  ClaimRejected: { action: 'CLAIM_REJECTED', targetType: 'CLAIM', actor: 'actorId' },
  ClaimCancelled: { action: 'CLAIM_CANCELLED', targetType: 'CLAIM', actor: 'actorId' },
  ClaimExpired: { action: 'CLAIM_EXPIRED', targetType: 'CLAIM', actor: null },
  ClaimCompleted: { action: 'HANDOVER_CONFIRMED', targetType: 'CLAIM', actor: 'actorId' },
  UserRoleChanged: { action: 'USER_ROLE_CHANGED', targetType: 'USER', actor: 'actorId' },
  UserSuspended: { action: 'USER_SUSPENDED', targetType: 'USER', actor: 'actorId' },
  UserReactivated: { action: 'USER_REACTIVATED', targetType: 'USER', actor: 'actorId' },
  ItemFlagged: { action: 'ITEM_FLAGGED', targetType: 'REPORT', actor: 'actorId' },
  ReportResolved: { action: 'REPORT_RESOLVED', targetType: 'REPORT', actor: 'actorId' },
} satisfies Partial<Record<DomainEventType, Mapping>>;

/** Fields copied into the audit entry when present (never secrets such as codes). */
const METADATA_FIELDS = [
  'itemId',
  'claimantId',
  'reporterId',
  'automatic',
  'previousStatus',
  'byModerator',
  'from',
  'to',
  'reason',
  'decision',
];

/** Writes an audit entry for every security-relevant domain event. */
export class AuditEventHandler implements EventHandler {
  readonly name = 'audit-log';
  readonly handles = Object.keys(MAPPINGS);

  constructor(private readonly audit: AuditTrail) {}

  async handle(event: StoredEvent): Promise<void> {
    if (!isDomainEventType(event.type) || !(event.type in MAPPINGS)) return;
    const mapping: Mapping = MAPPINGS[event.type as keyof typeof MAPPINGS];
    const payload = event.payload;
    const text = (field: string) => (typeof payload[field] === 'string' ? payload[field] : null);

    const action =
      event.type === 'ClaimCompleted' && payload.confirmedBy === 'STAFF'
        ? 'HANDOVER_CONFIRMED_BY_STAFF'
        : mapping.action;

    await this.audit.record({
      action,
      actorId:
        mapping.actor === 'aggregate'
          ? event.aggregateId
          : mapping.actor
            ? text(mapping.actor)
            : null,
      universityId: text('universityId'),
      targetType: mapping.targetType,
      targetId: event.aggregateId,
      occurredAt: event.occurredAt,
      metadata: Object.fromEntries(
        METADATA_FIELDS.filter((field) => field in payload).map((field) => [field, payload[field]]),
      ),
      sourceEventId: event.id,
    });
  }
}
