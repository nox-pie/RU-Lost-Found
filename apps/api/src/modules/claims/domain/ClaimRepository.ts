import type { ClaimStatus } from '@ru-lost-found/shared';
import type { PageRequest, PageResult } from '../../../core/persistence/Pagination';
import type { Repository, TenantScope } from '../../../core/persistence/Repository';
import type { TransactionContext } from '../../../core/persistence/UnitOfWork';
import type { Claim } from './Claim';

export interface ClaimSearchCriteria {
  claimantId?: string;
  reporterId?: string;
  itemId?: string;
  statuses?: readonly ClaimStatus[];
}

export interface ClaimRepository extends Repository<Claim> {
  findById(scope: TenantScope, id: string, tx?: TransactionContext): Promise<Claim | null>;

  /** REQUESTED or APPROVED claims on an item, oldest first. */
  findActiveByItem(scope: TenantScope, itemId: string, tx?: TransactionContext): Promise<Claim[]>;

  /** The claimant's REQUESTED or APPROVED claim on an item, if any. */
  findActiveByItemAndClaimant(
    scope: TenantScope,
    itemId: string,
    claimantId: string,
    tx?: TransactionContext,
  ): Promise<Claim | null>;

  /** Newest first. */
  search(
    scope: TenantScope,
    criteria: ClaimSearchCriteria,
    page: PageRequest,
  ): Promise<PageResult<Claim>>;

  /** True if the item's reporter has already rejected a claim by this person on this item. */
  wasRejectedByReporter(scope: TenantScope, itemId: string, claimantId: string): Promise<boolean>;

  /** APPROVED claims whose handover deadline has passed, across all universities (for the expiry job). */
  findOverdueApproved(now: Date, limit: number): Promise<Claim[]>;
}
