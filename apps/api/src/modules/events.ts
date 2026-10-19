import {
  ITEM_CATEGORIES,
  ITEM_CLOSE_REASONS,
  ITEM_STATUSES,
  ITEM_TYPES,
  MODERATION_DECISIONS,
  REPORT_REASONS,
  ROLES,
} from '@ru-lost-found/shared';
import { z } from 'zod';
import type { DomainEvent } from '../core/events/DomainEvent';
import type { StoredEvent } from '../core/events/EventHandler';

const id = z.string();

/** Who is involved in a claim; every claim event carries it (see Claim.recordEvent). */
const claimEvent = z.object({
  universityId: id,
  itemId: id,
  reporterId: id,
  claimantId: id,
  ownerId: id,
  finderId: id,
  /** Who caused the event; null for the system (expiry, automatic decisions). */
  actorId: id.nullable(),
});

/**
 * The domain events, with the payload each one carries: the contract between the module that
 * records an event and the modules that react to it (through the outbox, see core/events).
 *
 * Producers build events with `domainEvent()`, so the compiler checks the payload; handlers
 * read it with `payloadOf()`, which checks it again at run time (events are stored as JSON and
 * may have been written by an older version). Fields added later are optional or have a
 * default, so events already waiting in the outbox stay readable.
 */
export const DOMAIN_EVENTS = {
  UserRegistered: z.object({ universityId: id }),
  /** Older events have no `via`; they were all resets. */
  PasswordChanged: z.object({ via: z.enum(['RESET', 'SETTINGS']).default('RESET') }),
  AccountDeleted: z.object({ universityId: id }),
  UserRoleChanged: z.object({
    universityId: id,
    /** null when appointed from the command line or by ADMIN_EMAILS. */
    actorId: id.nullable(),
    from: z.enum(ROLES),
    to: z.enum(ROLES),
  }),
  UserSuspended: z.object({ universityId: id, actorId: id, reason: z.string() }),
  UserReactivated: z.object({ universityId: id, actorId: id }),

  ItemReported: z.object({
    universityId: id,
    reporterId: id,
    itemType: z.enum(ITEM_TYPES),
    category: z.enum(ITEM_CATEGORIES),
  }),
  ItemResolved: z.object({ universityId: id }),
  ItemRemoved: z.object({
    universityId: id,
    removedBy: id,
    byModerator: z.boolean(),
    /** Shown to the reporter when a moderator removes the post. */
    reason: z.string().nullable(),
    previousStatus: z.enum(ITEM_STATUSES),
    imagePublicIds: z.array(z.string()),
  }),

  ItemClosed: z.object({
    universityId: id,
    reporterId: id,
    /** The reporter, or null when it closed by itself (EXPIRED). */
    actorId: id.nullable(),
    reason: z.enum(ITEM_CLOSE_REASONS),
    previousStatus: z.enum(ITEM_STATUSES),
  }),
  ItemReopened: z.object({ universityId: id, reporterId: id }),
  /** An open post will close on `expiresAt` unless its reporter keeps it open. */
  ItemExpiringSoon: z.object({ universityId: id, reporterId: id, expiresAt: z.string() }),

  ClaimRequested: claimEvent,
  ClaimApproved: claimEvent.extend({ deadline: z.string() }),
  ClaimRejected: claimEvent.extend({ automatic: z.boolean() }),
  ClaimCancelled: claimEvent.extend({
    cancelledBy: id.nullable(),
    wasApproved: z.boolean(),
    /** Older events have no flag; the system cancelled when nobody did. */
    automatic: z.boolean().optional(),
    /** Why the system cancelled it, e.g. "The post was closed." (older events have none). */
    note: z.string().nullable().optional(),
  }),
  ClaimCompleted: claimEvent.extend({ confirmedBy: z.enum(['CODE', 'STAFF']) }),
  ClaimExpired: claimEvent,

  ItemFlagged: z.object({
    universityId: id,
    itemId: id,
    actorId: id,
    reason: z.enum(REPORT_REASONS),
  }),
  ReportResolved: z.object({
    universityId: id,
    itemId: id,
    actorId: id,
    decision: z.enum(MODERATION_DECISIONS),
  }),
} as const;

export type DomainEventType = keyof typeof DOMAIN_EVENTS;
/** What a producer passes (fields with a default may be left out). */
export type EventPayloadInput<T extends DomainEventType> = z.input<(typeof DOMAIN_EVENTS)[T]>;
/** What a handler reads. */
export type EventPayload<T extends DomainEventType> = z.output<(typeof DOMAIN_EVENTS)[T]>;

export function isDomainEventType(type: string): type is DomainEventType {
  return Object.hasOwn(DOMAIN_EVENTS, type);
}

/** An event for an aggregate to record; the payload must match the event's contract. */
export function domainEvent<T extends DomainEventType>(
  type: T,
  aggregateId: string,
  occurredAt: Date,
  payload: EventPayloadInput<T>,
): DomainEvent<T> {
  return { type, aggregateId, occurredAt, payload };
}

/** A stored event's payload, checked against its contract. Throws if it doesn't match. */
export function payloadOf<T extends DomainEventType>(event: StoredEvent, type: T): EventPayload<T> {
  if (event.type !== type) {
    throw new Error(`Expected a ${type} event, got ${event.type}`);
  }
  return DOMAIN_EVENTS[type].parse(event.payload) as EventPayload<T>;
}
