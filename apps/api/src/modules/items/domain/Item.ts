import {
  MAX_ITEM_PHOTOS,
  MAX_VERIFICATION_QUESTIONS,
  type ItemCategory,
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

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

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
      version: 0,
    });

    item.record({
      type: 'ItemReported',
      aggregateId: item.id,
      occurredAt: input.now,
      payload: {
        universityId: item.universityId,
        reporterId: item.reporterId,
        itemType: item.type,
        category: item.category,
      },
    });
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
    this.record({
      type: 'ItemResolved',
      aggregateId: this.id,
      occurredAt: now,
      payload: { universityId: this.universityId },
    });
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
    this.record({
      type: 'ItemRemoved',
      aggregateId: this.id,
      occurredAt: now,
      payload: {
        universityId: this.universityId,
        removedBy: actor.userId,
        byModerator: !this.isReportedBy(actor.userId),
        reason,
        previousStatus,
        imagePublicIds: this.props.images.map((image) => image.publicId),
      },
    });
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
