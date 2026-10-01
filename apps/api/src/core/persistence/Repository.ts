import type { AggregateRoot } from '../domain/AggregateRoot';
import type { TransactionContext } from './UnitOfWork';

/**
 * Write side shared by every repository. `update` fails with ConcurrencyError if the aggregate
 * was saved by someone else after it was loaded.
 */
export interface Repository<T extends AggregateRoot> {
  create(entity: T, tx?: TransactionContext): Promise<void>;
  update(entity: T, tx?: TransactionContext): Promise<void>;
}

/**
 * Limits a query to one university's data. Every tenant-owned repository method takes it,
 * so a query cannot silently read another university's records.
 */
export interface TenantScope {
  readonly universityId: string;
}
