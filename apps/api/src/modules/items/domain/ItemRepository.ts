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
  /** Only found items handed in at the security desk. */
  heldAtSecurityDesk?: boolean;
  /** One of the university's campus places. */
  place?: string;
  /** Lost or found on or after this day (midnight UTC, like `occurredOn`). */
  occurredFrom?: Date;
  /** Lost or found on or before this day. */
  occurredTo?: Date;
}

/** What the browse page filters by; the tab counts take the same filters as the list. */
export type FeedCriteria = Pick<
  ItemSearchCriteria,
  'text' | 'category' | 'place' | 'occurredFrom' | 'occurredTo'
>;

/** How many listable items there are of one type in one status. */
export interface ItemTally {
  type: ItemType;
  status: ItemStatus;
  count: number;
}

export interface ItemRepository extends Repository<Item> {
  /** Listable items (open, reserved, returned) matching the browse filters, by type and status. */
  tally(scope: TenantScope, criteria: FeedCriteria): Promise<ItemTally[]>;
  findById(scope: TenantScope, id: string, tx?: TransactionContext): Promise<Item | null>;
  /** Items with these ids in the university (unknown ids are skipped). */
  findByIds(scope: TenantScope, ids: readonly string[]): Promise<Item[]>;
  /** Open posts, across universities, closing by `expiringBy` whose reporter wasn't reminded yet. */
  findOpenNeedingReminder(expiringBy: Date, limit: number): Promise<Item[]>;
  /** Open posts, across universities, past `expiredBy` whose reporter was reminded by `remindedBy`. */
  findOpenToClose(expiredBy: Date, remindedBy: Date, limit: number): Promise<Item[]>;
  /**
   * Open posts of the given type and category, reported by someone else, that happened
   * between `occurredFrom` and `occurredTo`: the candidates for a match. Newest first.
   */
  findMatchCandidates(
    scope: TenantScope,
    criteria: {
      type: ItemType;
      category: ItemCategory;
      occurredFrom: Date;
      occurredTo: Date;
      excludeReporterId: string;
    },
    limit: number,
  ): Promise<Item[]>;
  /** Removed items, across all universities, still holding photos and removed before `before`. */
  findRemovedWithPhotos(before: Date, limit: number): Promise<Item[]>;
  /** Newest first. */
  search(
    scope: TenantScope,
    criteria: ItemSearchCriteria,
    page: PageRequest,
  ): Promise<PageResult<Item>>;
}
