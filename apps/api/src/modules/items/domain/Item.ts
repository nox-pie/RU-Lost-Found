import {
  MAX_ITEM_PHOTOS,
  MAX_VERIFICATION_QUESTIONS,
  type ItemCategory,
  type ItemCloseReason,
  type ItemStatus,
  type ItemType,
} from '@ru-lost-found/shared';
import { type Actor, isModerator } from '../../../core/domain/Actor';
import { AggregateRoot } from '../../../core/domain/AggregateRoot';
import type { ImageRef } from '../../../core/domain/ImageRef';
import {
  ForbiddenError,
  InvalidStateTransitionError,
  ValidationError,
} from '../../../core/errors/AppError';
import { domainEvent } from '../../events';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/** An open post stays open this long after it is posted, or after its reporter keeps it open. */
export const OPEN_FOR_DAYS = 60;
/** The reporter is reminded this long before, and a post never closes sooner after the reminder. */
export const REMINDER_DAYS = 7;

const daysAfter = (date: Date, days: number) => new Date(date.getTime() + days * ONE_DAY_MS);

/**
 * `occurredOn` is a calendar day stored as UTC midnight. For users ahead of UTC (India is +5:30),
 * "today" can be up to a day later than the server's UTC date, so allow one day of slack.
 */
function isInTheFuture(occurredOn: Date, now: Date): boolean {
  return occurredOn.getTime() > now.getTime() + ONE_DAY_MS;
}

/** A question the finder asks claimants, e.g. "What is the lock-screen wallpaper?". */
export interface VerificationQuestion {
  readonly id: string;
  readonly question: string;
}

export interface ItemProps {
  id: string;
  universityId: string;
  reporterId: string;
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
  /** Set while the post is CLOSED. */
  closeReason: ItemCloseReason | null;
  /** An open post closes after this, once its reporter was reminded (see expire()). */
  expiresAt: Date;
  /** When the reporter was reminded that the post will close; cleared when it is kept open. */
  expiryRemindedAt: Date | null;
  version: number;
}

export type EditableItemFields = Pick<
  ItemProps,
  'category' | 'title' | 'description' | 'location' | 'occurredOn' | 'heldAtSecurityDesk'
>;

/**
 * A lost or found report.
 *
 * Lifecycle: OPEN → RESERVED (a claim is approved) → RESOLVED (handover confirmed).
 * RESERVED can fall back to OPEN if the approved claim is cancelled or expires.
 * Any non-removed item can be REMOVED by its reporter or a moderator.
 */
export class Item extends AggregateRoot {
  private constructor(private props: ItemProps) {
    super(props.id, props.version);
  }

  static report(input: {
    id: string;
    universityId: string;
    reporterId: string;
    type: ItemType;
    category: ItemCategory;
    title: string;
    description: string;
    location: string;
    occurredOn: Date;
    images: ImageRef[];
    questions?: string[];
    heldAtSecurityDesk?: boolean;
    now: Date;
  }): Item {
    const questions = (input.questions ?? []).map((q) => q.trim()).filter(Boolean);

    if (input.images.length === 0) {
      throw new ValidationError('At least one photo of the item is required.');
    }
    if (input.images.length > MAX_ITEM_PHOTOS) {
      throw new ValidationError(`An item can have at most ${MAX_ITEM_PHOTOS} photos.`);
    }
    if (questions.length > MAX_VERIFICATION_QUESTIONS) {
      throw new ValidationError(
        `An item can have at most ${MAX_VERIFICATION_QUESTIONS} verification questions.`,
      );
    }
    if (questions.length > 0 && input.type !== 'FOUND') {
      throw new ValidationError('Only found items can have verification questions.');
    }
    if (isInTheFuture(input.occurredOn, input.now)) {
      throw new ValidationError('The date cannot be in the future.');
    }

    const item = new Item({
      id: input.id,
      universityId: input.universityId,
      reporterId: input.reporterId,
      type: input.type,
      category: input.category,
      title: input.title.trim(),
      description: input.description.trim(),
      location: input.location.trim(),
      occurredOn: input.occurredOn,
      images: [...input.images],
      verificationQuestions: questions.map((question, index) => ({
        id: `q${index + 1}`,
        question,
      })),
      heldAtSecurityDesk: input.heldAtSecurityDesk ?? false,
      status: 'OPEN',
      createdAt: input.now,
      updatedAt: input.now,
      resolvedAt: null,
      closeReason: null,
      expiresAt: daysAfter(input.now, OPEN_FOR_DAYS),
      expiryRemindedAt: null,
      version: 0,
    });

    item.record(
      domainEvent('ItemReported', item.id, input.now, {
        universityId: item.universityId,
        reporterId: item.reporterId,
        itemType: item.type,
        category: item.category,
      }),
    );
    return item;
  }

  static restore(props: ItemProps): Item {
    return new Item(props);
  }

  get universityId() {
    return this.props.universityId;
  }
  get reporterId() {
    return this.props.reporterId;
  }
  get type() {
    return this.props.type;
  }
  get category() {
    return this.props.category;
  }
  get title() {
    return this.props.title;
  }
  get description() {
    return this.props.description;
  }
  get location() {
    return this.props.location;
  }
  get occurredOn() {
    return this.props.occurredOn;
  }
  get images(): readonly ImageRef[] {
    return this.props.images;
  }
  get verificationQuestions(): readonly VerificationQuestion[] {
    return this.props.verificationQuestions;
  }
  get heldAtSecurityDesk() {
    return this.props.heldAtSecurityDesk;
  }
  get status() {
    return this.props.status;
  }
  get createdAt() {
    return this.props.createdAt;
  }
  get updatedAt() {
    return this.props.updatedAt;
  }
  get resolvedAt() {
    return this.props.resolvedAt;
  }

  isReportedBy(userId: string): boolean {
    return this.props.reporterId === userId;
  }

  get closeReason() {
    return this.props.closeReason;
  }
  get expiresAt() {
    return this.props.expiresAt;
  }
  get expiryRemindedAt() {
    return this.props.expiryRemindedAt;
  }

  get isAcceptingClaims(): boolean {
    return this.props.status === 'OPEN';
  }

  edit(actor: Actor, changes: Partial<EditableItemFields>, now: Date): void {
    if (!this.isReportedBy(actor.userId)) {
      throw new ForbiddenError('Only the person who reported this item can edit it.');
    }
    this.requireStatus('OPEN', 'edited');
    if (changes.occurredOn && isInTheFuture(changes.occurredOn, now)) {
      throw new ValidationError('The date cannot be in the future.');
    }

    const defined = Object.fromEntries(
      Object.entries(changes).filter(([, value]) => value !== undefined),
    ) as Partial<EditableItemFields>;
    this.props = { ...this.props, ...defined, updatedAt: now };
  }

  /** A claim on this item was approved; no further claims are accepted until it resolves or falls through. */
  reserve(now: Date): void {
    this.requireStatus('OPEN', 'reserved');
    this.transition('RESERVED', now);
  }

  /** The approved claim was cancelled or expired. */
  reopen(now: Date): void {
    this.requireStatus('RESERVED', 'reopened');
    this.transition('OPEN', now);
  }

  /** The item was handed over to its owner. */
  resolve(now: Date): void {
    this.requireStatus('RESERVED', 'resolved');
    this.transition('RESOLVED', now);
    this.props.resolvedAt = now;
    this.record(domainEvent('ItemResolved', this.id, now, { universityId: this.universityId }));
  }

  /**
   * The reporter closes their open post without a handover through the portal: it is back with
   * its owner some other way, or no longer needed. Open claims on it are closed (by the claims
   * module, reacting to ItemClosed). A post with an approved claim must have it cancelled first.
   */
  close(actor: Actor, reason: Exclude<ItemCloseReason, 'EXPIRED'>, now: Date): void {
    this.requireReporter(actor, 'close');
    this.requireStatus('OPEN', 'closed');
    this.closeWith(reason, now);
  }

  /**
   * The reporter wants the post to stay up: an open post gets another OPEN_FOR_DAYS, a closed
   * one opens again. A post returned through a handover or removed can't be reopened.
   */
  keepOpen(actor: Actor, now: Date): void {
    this.requireReporter(actor, 'keep open');
    if (this.props.status !== 'OPEN' && this.props.status !== 'CLOSED') {
      throw new InvalidStateTransitionError(
        `This item cannot be kept open because it is ${this.props.status.toLowerCase()}.`,
      );
    }
    const reopened = this.props.status === 'CLOSED';
    this.props.closeReason = null;
    this.props.expiresAt = daysAfter(now, OPEN_FOR_DAYS);
    this.props.expiryRemindedAt = null;
    this.transition('OPEN', now);
    if (reopened) {
      this.record(
        domainEvent('ItemReopened', this.id, now, {
          universityId: this.universityId,
          reporterId: this.reporterId,
        }),
      );
    }
  }

  /**
   * Scheduled job: once an open post is within REMINDER_DAYS of closing, its reporter is told
   * (once). Returns whether a reminder was due.
   */
  remindOfExpiry(now: Date): boolean {
    const due = daysAfter(this.props.expiresAt, -REMINDER_DAYS) <= now;
    if (this.props.status !== 'OPEN' || this.props.expiryRemindedAt || !due) return false;
    this.props.expiryRemindedAt = now;
    this.record(
      domainEvent('ItemExpiringSoon', this.id, now, {
        universityId: this.universityId,
        reporterId: this.reporterId,
        expiresAt: this.props.expiresAt.toISOString(),
      }),
    );
    return true;
  }

  /**
   * Scheduled job: closes an open post past its expiry, but never sooner than REMINDER_DAYS
   * after the reminder (a post back open after a failed handover gets its week too).
   * Returns whether it closed.
   */
  expire(now: Date): boolean {
    const reminded = this.props.expiryRemindedAt;
    const warned = reminded !== null && daysAfter(reminded, REMINDER_DAYS) <= now;
    if (this.props.status !== 'OPEN' || this.props.expiresAt > now || !warned) return false;
    this.closeWith('EXPIRED', now);
    return true;
  }

  /** `reason` is given by moderators, and shown to the reporter. */
  remove(actor: Actor, now: Date, reason: string | null = null): void {
    if (!this.isReportedBy(actor.userId) && !isModerator(actor)) {
      throw new ForbiddenError('Only the reporter or an admin can remove this item.');
    }
    if (this.props.status === 'REMOVED') {
      throw new InvalidStateTransitionError('This item has already been removed.');
    }
    const previousStatus = this.props.status;
    this.transition('REMOVED', now);
    this.record(
      domainEvent('ItemRemoved', this.id, now, {
        universityId: this.universityId,
        removedBy: actor.userId,
        byModerator: !this.isReportedBy(actor.userId),
        reason,
        previousStatus,
        imagePublicIds: this.props.images.map((image) => image.publicId),
      }),
    );
  }

  /**
   * Clean-up of a removed item's photos (after the moderation period). Returns what to delete
   * from storage. The item record itself is kept.
   */
  releasePhotos(): ImageRef[] {
    this.requireStatus('REMOVED', 'cleaned up');
    const photos = this.props.images;
    this.props.images = [];
    return photos;
  }

  private closeWith(reason: ItemCloseReason, now: Date): void {
    const previousStatus = this.props.status;
    this.props.closeReason = reason;
    this.transition('CLOSED', now);
    this.record(
      domainEvent('ItemClosed', this.id, now, {
        universityId: this.universityId,
        reporterId: this.reporterId,
        actorId: reason === 'EXPIRED' ? null : this.reporterId,
        reason,
        previousStatus,
      }),
    );
  }

  private requireReporter(actor: Actor, action: string): void {
    if (!this.isReportedBy(actor.userId)) {
      throw new ForbiddenError(`Only the person who reported this item can ${action} it.`);
    }
  }

  private requireStatus(expected: ItemStatus, action: string): void {
    if (this.props.status !== expected) {
      throw new InvalidStateTransitionError(
        `This item cannot be ${action} because it is ${this.props.status.toLowerCase()}.`,
      );
    }
  }

  private transition(status: ItemStatus, now: Date): void {
    this.props.status = status;
    this.props.updatedAt = now;
  }
}
