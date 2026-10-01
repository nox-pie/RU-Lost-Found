import type { PageRequest, PageResult } from '../../../core/persistence/Pagination';
import type { Repository, TenantScope } from '../../../core/persistence/Repository';
import type { TransactionContext } from '../../../core/persistence/UnitOfWork';
import type { ModerationReport } from './ModerationReport';

export interface ModerationReportRepository extends Repository<ModerationReport> {
  findOpenForItem(
    scope: TenantScope,
    itemId: string,
    tx?: TransactionContext,
  ): Promise<ModerationReport[]>;
  /** Newest first. `open`: waiting for a decision; otherwise decided ones. */
  list(scope: TenantScope, open: boolean, page: PageRequest): Promise<PageResult<ModerationReport>>;
  countOpen(scope: TenantScope): Promise<number>;
}
