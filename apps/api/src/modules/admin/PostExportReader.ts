import type { ItemCategory, ItemCloseReason, ItemStatus, ItemType } from '@ru-lost-found/shared';
import type { TenantScope } from '../../core/persistence/Repository';

/** One post as the university's report shows it: what happened, never who. */
export interface ExportedPost {
  createdAt: Date;
  type: ItemType;
  category: ItemCategory;
  title: string;
  place: string | null;
  location: string;
  occurredOn: Date;
  status: ItemStatus;
  closeReason: ItemCloseReason | null;
  resolvedAt: Date | null;
  heldAtSecurityDesk: boolean;
}

/** Read model for the posts export (a report for the university). */
export interface PostExportReader {
  /** Posts reported from `from` (inclusive) until `until` (exclusive), oldest first. */
  postsReported(
    scope: TenantScope,
    period: { from?: Date; until?: Date },
    limit: number,
  ): Promise<ExportedPost[]>;
}
