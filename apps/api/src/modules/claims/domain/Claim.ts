import type { ClaimKind, ClaimStatus } from '@ru-lost-found/shared';
import { type Actor, isStaff } from '../../../core/domain/Actor';
import { AggregateRoot } from '../../../core/domain/AggregateRoot';
import {
  ForbiddenError,
  InvalidStateTransitionError,
  ValidationError,
} from '../../../core/errors/AppError';
import type { Item } from '../../items/domain/Item';
import { type ClaimState, claimStateFor } from './ClaimState';

export const MAX_HANDOVER_ATTEMPTS = 5;

export interface ClaimAnswer {
  readonly questionId: string;
  readonly answer: string;
}

/**
 * Created when a claim is approved. The item's owner sees the code in the app and shows it
 * to the finder when they meet; the finder enters it to prove the handover happened.
 * Stored readable (not hashed) because the owner must be able to view it; it is protected by
 * the attempt limit, the deadline, and by only ever being shown to the owner.
 */
export interface Handover {
  readonly code: string;
  readonly deadline: Date;
  readonly failedAttempts: number;
}

export interface ClaimHistoryEntry {
  readonly from: ClaimStatus | null;
  readonly to: ClaimStatus;
  /** null when the system made the change (e.g. expiry). */
  readonly byUserId: string | null;
  readonly at: Date;
  readonly note: string | null;
}

export interface ClaimProps {
  id: string;
  universityId: string;
  itemId: string;
  reporterId: string;
  claimantId: string;
  kind: ClaimKind;
  message: string;
  answers: ClaimAnswer[];
  status: ClaimStatus;
  handover: Handover | null;
  rejectionReason: string | null;
  /** Each side decides whether the other may see their phone number once the claim is approved. */
  claimantSharesPhone: boolean;
  reporterSharesPhone: boolean;
  history: ClaimHistoryEntry[];
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

export type HandoverResult = 'COMPLETED' | 'WRONG_CODE' | 'LOCKED';

/**
 * A request connecting an item's reporter with another user:
 * - OWNERSHIP (on a FOUND item): "this is mine" + answers to the finder's verification questions.
 * - FINDER (on a LOST item): "I found this".
 *
 * Legal status changes are delegated to ClaimState (State pattern); this class enforces
 * who may perform each action and keeps the data and history consistent.
 */
export class Claim extends AggregateRoot {
  private state: ClaimState;

  private constructor(private props: ClaimProps) {
    super(props.id, props.version);
    this.state = claimStateFor(props.status);
  }

  static submit(input: {
    id: string;
    item: Item;
    claimant: Actor;
    message: string;
    answers?: ClaimAnswer[];
    sharePhone?: boolean;
    now: Date;
  }): Claim {
    const { item, claimant, now } = input;

    if (item.isReportedBy(claimant.userId)) {
      throw new ForbiddenError('You cannot claim an item you reported.');
    }
    if (!item.isAcceptingClaims) {
      throw new InvalidStateTransitionError('This item is not accepting claims right now.');
    }

    const kind: ClaimKind = item.type === 'FOUND' ? 'OWNERSHIP' : 'FINDER';
    const answers = Claim.validateAnswers(item, input.answers ?? []);

    const claim = new Claim({
      id: input.id,
      universityId: item.universityId,
      itemId: item.id,
      reporterId: item.reporterId,
      claimantId: claimant.userId,
      kind,
      message: input.message.trim(),
      answers,
      status: 'REQUESTED',
      handover: null,
      rejectionReason: null,
      claimantSharesPhone: input.sharePhone ?? false,
      reporterSharesPhone: false,
      history: [{ from: null, to: 'REQUESTED', byUserId: claimant.userId, at: now, note: null }],
      createdAt: now,
      updatedAt: now,
      version: 0,
    });
    claim.recordEvent('ClaimRequested', now);
    return claim;
  }

  static restore(props: ClaimProps): Claim {
    return new Claim(props);
  }

  /** Every verification question must be answered exactly once; lost-item claims take no answers. */
  private static validateAnswers(item: Item, answers: ClaimAnswer[]): ClaimAnswer[] {
    const questions = item.verificationQuestions;
    if (questions.length === 0) {
      if (answers.length > 0) {
        throw new ValidationError('This item has no verification questions to answer.');
      }
      return [];
    }

    const byId = new Map(answers.map((a) => [a.questionId, a.answer.trim()]));
    const missing = questions.filter((q) => !byId.get(q.id));
    const unknown = [...byId.keys()].filter((id) => !questions.some((q) => q.id === id));
    if (missing.length > 0 || unknown.length > 0 || byId.size !== answers.length) {
      throw new ValidationError('Please answer each verification question once.');
    }
    return questions.map((q) => ({ questionId: q.id, answer: byId.get(q.id) as string }));
  }

  get universityId() {
    return this.props.universityId;
  }
  get itemId() {
    return this.props.itemId;
  }
  get reporterId() {
    return this.props.reporterId;
  }
  get claimantId() {
    return this.props.claimantId;
  }
  get kind() {
    return this.props.kind;
  }
  get message() {
    return this.props.message;
  }
  get answers(): readonly ClaimAnswer[] {
    return this.props.answers;
  }
  get status() {
    return this.props.status;
  }
  get handover(): Handover | null {
    return this.props.handover;
  }
  get claimantSharesPhone() {
    return this.props.claimantSharesPhone;
  }
  get reporterSharesPhone() {
    return this.props.reporterSharesPhone;
  }
  get rejectionReason() {
    return this.props.rejectionReason;
  }
  get history(): readonly ClaimHistoryEntry[] {
    return this.props.history;
  }
  get createdAt() {
    return this.props.createdAt;
  }
  get updatedAt() {
    return this.props.updatedAt;
  }

  /** REQUESTED or APPROVED. */
  get isActive(): boolean {
    return this.state.isActive;
  }

  /** The person the item belongs to: the claimant of a found item, the reporter of a lost item. */
  get ownerId(): string {
    return this.props.kind === 'OWNERSHIP' ? this.props.claimantId : this.props.reporterId;
  }

  /** The person who has the item and hands it over. */
  get finderId(): string {
    return this.props.kind === 'OWNERSHIP' ? this.props.reporterId : this.props.claimantId;
  }

  isParty(userId: string): boolean {
    return userId === this.props.reporterId || userId === this.props.claimantId;
  }

  approve(
    actor: Actor,
    handover: { code: string; deadline: Date; sharePhone?: boolean },
    now: Date,
  ): void {
    this.requireReporter(actor, 'approve');
    const next = this.state.approve();
    this.props.handover = { code: handover.code, deadline: handover.deadline, failedAttempts: 0 };
    this.props.reporterSharesPhone = handover.sharePhone ?? false;
    this.transitionTo(next, actor.userId, now);
    this.recordEvent('ClaimApproved', now, { deadline: handover.deadline.toISOString() });
  }

  reject(actor: Actor, reason: string | null, now: Date): void {
    this.requireReporter(actor, 'reject');
    this.rejectWith(actor.userId, reason?.trim() || null, now);
  }

  /** Used when another claim on the same item is completed. */
  rejectAutomatically(reason: string, now: Date): void {
    this.rejectWith(null, reason, now);
  }

  cancel(actor: Actor, now: Date): void {
    if (!this.isParty(actor.userId)) {
      throw new ForbiddenError('Only the people involved can cancel this claim.');
    }
    const wasApproved = this.props.status === 'APPROVED';
    const next = this.state.cancel();
    this.transitionTo(next, actor.userId, now);
    this.recordEvent('ClaimCancelled', now, { cancelledBy: actor.userId, wasApproved });
  }

  /** Used when the item is removed: any active claim on it ends. */
  cancelAutomatically(reason: string, now: Date): void {
    const wasApproved = this.props.status === 'APPROVED';
    const next = this.state.cancel();
    this.transitionTo(next, null, now, reason);
    this.recordEvent('ClaimCancelled', now, { cancelledBy: null, wasApproved });
  }

  /**
   * The finder enters the code the owner shows them. A wrong code is counted instead of thrown,
   * so the caller can save the attempt; after MAX_HANDOVER_ATTEMPTS only staff can complete it.
   */
  completeHandover(actor: Actor, code: string, now: Date): HandoverResult {
    if (actor.userId !== this.finderId) {
      throw new ForbiddenError('Only the person handing over the item can enter the code.');
    }
    const next = this.state.completeHandover();
    const handover = this.requireHandover();

    if (now.getTime() > handover.deadline.getTime()) {
      throw new InvalidStateTransitionError('The handover deadline has passed.');
    }
    if (handover.failedAttempts >= MAX_HANDOVER_ATTEMPTS) {
      return 'LOCKED';
    }
    if (code.trim() !== handover.code) {
      const failedAttempts = handover.failedAttempts + 1;
      this.props.handover = { ...handover, failedAttempts };
      this.props.updatedAt = now;
      return failedAttempts >= MAX_HANDOVER_ATTEMPTS ? 'LOCKED' : 'WRONG_CODE';
    }

    this.transitionTo(next, actor.userId, now);
    this.recordEvent('ClaimCompleted', now, { confirmedBy: 'CODE' });
    return 'COMPLETED';
  }

  /** Security desk or admin confirms the handover in person, e.g. when the code is locked. */
  completeHandoverAsStaff(actor: Actor, now: Date): void {
    if (!isStaff(actor)) {
      throw new ForbiddenError('Only security desk staff can confirm a handover without a code.');
    }
    if (this.isParty(actor.userId)) {
      throw new ForbiddenError('Staff cannot confirm a handover of their own claim or item.');
    }
    const next = this.state.completeHandover();
    this.transitionTo(next, actor.userId, now, 'Confirmed by staff');
    this.recordEvent('ClaimCompleted', now, { confirmedBy: 'STAFF' });
  }

  /** Run by a scheduled job once the handover deadline has passed. */
  expire(now: Date): void {
    const next = this.state.expire();
    const handover = this.requireHandover();
    if (now.getTime() <= handover.deadline.getTime()) {
      throw new InvalidStateTransitionError('The handover deadline has not passed yet.');
    }
    this.transitionTo(next, null, now);
    this.recordEvent('ClaimExpired', now);
  }

  private rejectWith(byUserId: string | null, reason: string | null, now: Date): void {
    const next = this.state.reject();
    this.props.rejectionReason = reason;
    this.transitionTo(next, byUserId, now, reason);
    this.recordEvent('ClaimRejected', now, { automatic: byUserId === null });
  }

  private requireReporter(actor: Actor, action: string): void {
    if (actor.userId !== this.props.reporterId) {
      throw new ForbiddenError(`Only the person who reported the item can ${action} claims.`);
    }
  }

  private requireHandover(): Handover {
    if (!this.props.handover) {
      throw new InvalidStateTransitionError('This claim has no handover in progress.');
    }
    return this.props.handover;
  }

  private transitionTo(
    status: ClaimStatus,
    byUserId: string | null,
    now: Date,
    note: string | null = null,
  ): void {
    this.props.history = [
      ...this.props.history,
      { from: this.props.status, to: status, byUserId, at: now, note },
    ];
    this.props.status = status;
    this.props.updatedAt = now;
    this.state = claimStateFor(status);
  }

  private recordEvent(type: string, now: Date, extra: Record<string, unknown> = {}): void {
    this.record({
      type,
      aggregateId: this.id,
      occurredAt: now,
      payload: {
        universityId: this.universityId,
        itemId: this.itemId,
        reporterId: this.reporterId,
        claimantId: this.claimantId,
        ownerId: this.ownerId,
        finderId: this.finderId,
        /** Who caused this event (the latest history entry); null for the system. */
        actorId: this.props.history.at(-1)?.byUserId ?? null,
        ...extra,
      },
    });
  }
}
