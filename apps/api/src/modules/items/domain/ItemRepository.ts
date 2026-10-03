import type { ItemCategory, ItemStatus, ItemType } from '@ru-lost-found/shared';
import type { PageRequest, PageResult } from '../../../core/persistence/Pagination';
import type { Repository, TenantScope } from '../../../core/persistence/Repository';
import type { TransactionContext } from '../../../core/persistence/UnitOfWork';
import type { Item } from './Item';

export interface ItemSearchCriteria {
  /** Words to match in the title, location and description. */
  text?: string;
  type?: ItemType;
  category?: ItemCategory;
  statuses: readonly ItemStatus[];
  reporterId?: string;
}

/** How many listable items there are of one type in one status. */
export interface ItemTally {
  type: ItemType;
  status: ItemStatus;
  count: number;
}

export interface ItemRepository extends Repository<Item> {
  /** Listable items (open, reserved, returned) matching the text and category, by type and status. */
  tally(
    scope: TenantScope,
    criteria: Pick<ItemSearchCriteria, 'text' | 'category'>,
  ): Promise<ItemTally[]>;
  findById(scope: TenantScope, id: string, tx?: TransactionContext): Promise<Item | null>;
  /** Items with these ids in the university (unknown ids are skipped). */
  findByIds(scope: TenantScope, ids: readonly string[]): Promise<Item[]>;
  /** Removed items, across all universities, still holding photos and removed before `before`. */
  findRemovedWithPhotos(before: Date, limit: number): Promise<Item[]>;
  /** Newest first. */
  search(
    scope: TenantScope,
    criteria: ItemSearchCriteria,
    page: PageRequest,
  ): Promise<PageResult<Item>>;
}
