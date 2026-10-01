import type { Role, UserStatus } from '@ru-lost-found/shared';
import type { PageRequest, PageResult } from '../../../core/persistence/Pagination';
import type { Repository, TenantScope } from '../../../core/persistence/Repository';
import type { TransactionContext } from '../../../core/persistence/UnitOfWork';
import type { User } from './User';

/** Emails are unique across the whole platform, so users are looked up without a tenant scope. */
export interface UserRepository extends Repository<User> {
  findById(id: string, tx?: TransactionContext): Promise<User | null>;
  findByEmail(email: string, tx?: TransactionContext): Promise<User | null>;
  /** Users with these ids (unknown ids are skipped). */
  findByIds(ids: readonly string[]): Promise<User[]>;
  /** A university's users, newest first (admin screen). */
  search(
    scope: TenantScope,
    criteria: UserSearchCriteria,
    page: PageRequest,
  ): Promise<PageResult<User>>;
}

export interface UserSearchCriteria {
  /** Every word must be the start of the first name, last name or email. */
  text?: string;
  role?: Role;
  status?: UserStatus;
}
