import type { ApproveClaimInput, ListClaimsQuery, SubmitClaimInput } from '@ru-lost-found/shared';
import type { AuditTrail } from '../../core/audit/AuditTrail';
import { type Actor, isStaff } from '../../core/domain/Actor';
import type { Clock } from '../../core/domain/Clock';
import type { IdGenerator } from '../../core/domain/IdGenerator';
import { ConflictError, ForbiddenError, NotFoundError } from '../../core/errors/AppError';
import type { Logger } from '../../core/logger/logger';
import type { PageResult } from '../../core/persistence/Pagination';
import type { TenantScope } from '../../core/persistence/Repository';
import type { TransactionContext, UnitOfWork } from '../../core/persistence/UnitOfWork';
import type { Item } from '../items/domain/Item';
import type { ItemRepository } from '../items/domain/ItemRepository';
import type { UserRepository } from '../users/domain/UserRepository';
import { Claim, MAX_HANDOVER_ATTEMPTS } from './domain/Claim';
import type { ClaimRepository } from './domain/ClaimRepository';
import { HandoverCodeIncorrectError, HandoverLockedError } from './domain/errors';
import type { ClaimView } from './claim.mapper';

/** How long the two people have to meet after a claim is approved. */
const HANDOVER_WINDOW_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface ClaimServiceDeps {
  claims: ClaimRepository;
  items: ItemRepository;
  users: UserRepository;
  unitOfWork: UnitOfWork;
  ids: IdGenerator;
  clock: Clock;
  generateHandoverCode: () => string;
  logger: Logger;
  audit: AuditTrail;
}

/**
 * Claim use cases. Every change that touches both a claim and its item (approve, cancel,
 * handover, expiry) runs in one transaction, so the two can never disagree: an item is
 * RESERVED exactly when one of its claims is APPROVED, and RESOLVED exactly when one is COMPLETED.
 */
export class ClaimService {
  constructor(private readonly deps: ClaimServiceDeps) {}

  async submit(
    actor: Actor,
    scope: TenantScope,
    itemId: string,
    input: SubmitClaimInput,
  ): Promise<ClaimView> {
    const { claims, items, ids, clock } = this.deps;
    const item = await items.findById(scope, itemId);
    if (!item || item.status === 'REMOVED') throw new NotFoundError('Item');

    // Demo accounts (sample data for visitors) only ever touch sample posts, so the hourly
    // demo reset can't affect anyone's real posts.
    const people = await this.deps.users.findByIds([actor.userId, item.reporterId]);
    const isDemo = (id: string) => people.find((u) => u.id === id)?.isDemo ?? false;
    if (isDemo(actor.userId) && !isDemo(item.reporterId)) {
      throw new ForbiddenError('Demo accounts can only claim sample posts.');
    }

    if (await claims.wasRejectedByReporter(scope, item.id, actor.userId)) {
      throw new ForbiddenError('The reporter has already declined your claim on this item.');
    }

    const claim = Claim.submit({
      id: ids.next(),
      item,
      claimant: actor,
      message: input.message,
      answers: input.answers,
      sharePhone: input.sharePhone,
      now: clock.now(),
    });
    await claims.create(claim);
    return this.view(claim, item);
  }

  /** The reporter accepts a claim: the item is reserved and a handover code is issued. */
  async approve(
    actor: Actor,
    scope: TenantScope,
    claimId: string,
    input: ApproveClaimInput,
  ): Promise<ClaimView> {
    const { claim, item } = await this.deps.unitOfWork.run(async (tx) => {
      const { claim, item } = await this.load(scope, claimId, tx);
      const now = this.deps.clock.now();

      claim.approve(
        actor,
        {
          code: this.deps.generateHandoverCode(),
          deadline: new Date(now.getTime() + HANDOVER_WINDOW_DAYS * DAY_MS),
          sharePhone: input.sharePhone,
        },
        now,
      );
      if (item.status !== 'OPEN') {
        throw new ConflictError(
          item.status === 'RESERVED'
            ? 'Another claim on this item is already approved. Cancel it before approving this one.'
            : 'This item is no longer accepting claims.',
        );
      }
      item.reserve(now);

      await this.deps.claims.update(claim, tx);
      await this.deps.items.update(item, tx);
      return { claim, item };
    });
    return this.view(claim, item);
  }

  async reject(
    actor: Actor,
    scope: TenantScope,
    claimId: string,
    reason: string | undefined,
  ): Promise<ClaimView> {
    const { claim, item } = await this.load(scope, claimId);
    claim.reject(actor, reason ?? null, this.deps.clock.now());
    await this.deps.claims.update(claim);
    return this.view(claim, item);
  }

  /** Either person withdraws. If the claim was approved, the item is open for claims again. */
  async cancel(actor: Actor, scope: TenantScope, claimId: string): Promise<ClaimView> {
    const { claim, item } = await this.deps.unitOfWork.run(async (tx) => {
      const { claim, item } = await this.load(scope, claimId, tx);
      const now = this.deps.clock.now();
      const wasApproved = claim.status === 'APPROVED';

      claim.cancel(actor, now);
      await this.deps.claims.update(claim, tx);
      if (wasApproved && item.status === 'RESERVED') {
        item.reopen(now);
        await this.deps.items.update(item, tx);
      }
      return { claim, item };
    });
    return this.view(claim, item);
  }

  /**
   * The finder enters the code the owner shows them. A wrong code is saved (the transaction
   * commits the attempt count) before the error is reported, so retrying can't reset the limit.
   */
  async confirmHandover(
    actor: Actor,
    scope: TenantScope,
    claimId: string,
    code: string,
  ): Promise<ClaimView> {
    const outcome = await this.deps.unitOfWork.run(async (tx) => {
      const { claim, item } = await this.load(scope, claimId, tx);
      const now = this.deps.clock.now();

      const attemptsBefore = claim.handover?.failedAttempts ?? 0;
      const result = claim.completeHandover(actor, code, now);
      const justLocked = result === 'LOCKED' && attemptsBefore < MAX_HANDOVER_ATTEMPTS;
      if (result === 'COMPLETED') {
        await this.finishHandover(scope, claim, item, now, tx);
      } else {
        await this.deps.claims.update(claim, tx);
      }
      return { result, claim, item, justLocked };
    });

    if (outcome.justLocked) {
      await this.deps.audit.recordSafely({
        action: 'HANDOVER_LOCKED',
        actorId: actor.userId,
        universityId: scope.universityId,
        targetType: 'CLAIM',
        targetId: claimId,
        occurredAt: this.deps.clock.now(),
        metadata: { itemId: outcome.claim.itemId },
      });
    }

    if (outcome.result === 'WRONG_CODE') {
      const failed = outcome.claim.handover?.failedAttempts ?? 0;
      throw new HandoverCodeIncorrectError(MAX_HANDOVER_ATTEMPTS - failed);
    }
    if (outcome.result === 'LOCKED') throw new HandoverLockedError();
    return this.view(outcome.claim, outcome.item);
  }

  /** Security desk staff confirm a handover they witnessed (e.g. when the code is locked). */
  async confirmHandoverAsStaff(
    actor: Actor,
    scope: TenantScope,
    claimId: string,
  ): Promise<ClaimView> {
    const { claim, item } = await this.deps.unitOfWork.run(async (tx) => {
      const { claim, item } = await this.load(scope, claimId, tx);
      const now = this.deps.clock.now();
      claim.completeHandoverAsStaff(actor, now);
      await this.finishHandover(scope, claim, item, now, tx);
      return { claim, item };
    });
    return this.view(claim, item);
  }

  /**
   * Scheduled job: approved claims whose deadline passed are expired and their items reopened.
   * Each claim is handled in its own transaction, so one failure doesn't block the rest.
   * Returns how many were expired.
   */
  async expireOverdue(limit = 100): Promise<number> {
    const now = this.deps.clock.now();
    const overdue = await this.deps.claims.findOverdueApproved(now, limit);
    let expired = 0;

    for (const candidate of overdue) {
      const scope = { universityId: candidate.universityId };
      try {
        await this.deps.unitOfWork.run(async (tx) => {
          const { claim, item } = await this.load(scope, candidate.id, tx);
          if (claim.status !== 'APPROVED') return; // changed since the query
          claim.expire(now);
          await this.deps.claims.update(claim, tx);
          if (item.status === 'RESERVED') {
            item.reopen(now);
            await this.deps.items.update(item, tx);
          }
        });
        expired += 1;
      } catch (err) {
        this.deps.logger.error({ err, claimId: candidate.id }, 'Could not expire claim');
      }
    }
    return expired;
  }

  /** When an item is removed, every active claim on it ends. */
  async closeClaimsForRemovedItem(scope: TenantScope, itemId: string): Promise<number> {
    const active = await this.deps.claims.findActiveByItem(scope, itemId);
    const now = this.deps.clock.now();
    for (const claim of active) {
      claim.cancelAutomatically('The item was removed.', now);
      await this.deps.claims.update(claim);
    }
    return active.length;
  }

  /** A claim, visible only to the two people involved and to staff. */
  async get(actor: Actor, scope: TenantScope, claimId: string): Promise<ClaimView> {
    const claim = await this.deps.claims.findById(scope, claimId);
    if (!claim || !(claim.isParty(actor.userId) || isStaff(actor))) {
      throw new NotFoundError('Claim');
    }
    const [view] = await this.views(scope, [claim]);
    return view as ClaimView;
  }

  /** Claims on one item: for its reporter and for staff. */
  async listForItem(
    actor: Actor,
    scope: TenantScope,
    itemId: string,
    query: ListClaimsQuery,
  ): Promise<PageResult<ClaimView>> {
    const item = await this.deps.items.findById(scope, itemId);
    if (!item || item.status === 'REMOVED') throw new NotFoundError('Item');
    if (!item.isReportedBy(actor.userId) && !isStaff(actor)) {
      throw new ForbiddenError('Only the person who reported this item can see its claims.');
    }
    return this.search(scope, { itemId, statuses: query.status }, query);
  }

  /** Claims I submitted. */
  listMine(
    actor: Actor,
    scope: TenantScope,
    query: ListClaimsQuery,
  ): Promise<PageResult<ClaimView>> {
    return this.search(scope, { claimantId: actor.userId, statuses: query.status }, query);
  }

  /** Claims others made on items I reported. */
  listReceived(
    actor: Actor,
    scope: TenantScope,
    query: ListClaimsQuery,
  ): Promise<PageResult<ClaimView>> {
    return this.search(scope, { reporterId: actor.userId, statuses: query.status }, query);
  }

  private async search(
    scope: TenantScope,
    criteria: Parameters<ClaimRepository['search']>[1],
    query: ListClaimsQuery,
  ): Promise<PageResult<ClaimView>> {
    const page = await this.deps.claims.search(scope, criteria, {
      cursor: query.cursor,
      limit: query.limit,
    });
    return { items: await this.views(scope, page.items), nextCursor: page.nextCursor };
  }

  /** Resolves the item and turns down every other open claim on it. */
  private async finishHandover(
    scope: TenantScope,
    claim: Claim,
    item: Item,
    now: Date,
    tx: TransactionContext,
  ): Promise<void> {
    item.resolve(now);
    await this.deps.claims.update(claim, tx);
    await this.deps.items.update(item, tx);

    const others = await this.deps.claims.findActiveByItem(scope, item.id, tx);
    for (const other of others) {
      if (other.id === claim.id) continue;
      other.rejectAutomatically('The item was handed over to someone else.', now);
      await this.deps.claims.update(other, tx);
    }
  }

  private async load(scope: TenantScope, claimId: string, tx?: TransactionContext) {
    const claim = await this.deps.claims.findById(scope, claimId, tx);
    if (!claim) throw new NotFoundError('Claim');
    const item = await this.deps.items.findById(scope, claim.itemId, tx);
    if (!item) throw new NotFoundError('Item');
    return { claim, item };
  }

  private async view(claim: Claim, item: Item): Promise<ClaimView> {
    const users = await this.deps.users.findByIds([claim.claimantId, claim.reporterId]);
    const byId = new Map(users.map((user) => [user.id, user]));
    return {
      claim,
      item,
      claimant: byId.get(claim.claimantId),
      reporter: byId.get(claim.reporterId),
    };
  }

  /** Loads the items and people of a page with two batch queries, whatever the page size. */
  private async views(scope: TenantScope, claims: Claim[]): Promise<ClaimView[]> {
    const [items, users] = await Promise.all([
      this.deps.items.findByIds(
        scope,
        claims.map((claim) => claim.itemId),
      ),
      this.deps.users.findByIds(claims.flatMap((claim) => [claim.claimantId, claim.reporterId])),
    ]);
    const itemsById = new Map(items.map((item) => [item.id, item]));
    const usersById = new Map(users.map((user) => [user.id, user]));
    return claims.map((claim) => ({
      claim,
      item: itemsById.get(claim.itemId),
      claimant: usersById.get(claim.claimantId),
      reporter: usersById.get(claim.reporterId),
    }));
  }
}
