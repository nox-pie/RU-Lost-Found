import type { ItemCategory, ItemCloseReason, ItemStatus, ItemType } from '@ru-lost-found/shared';
import type { Connection } from 'mongoose';
import type { TenantScope } from '../../../core/persistence/Repository';
import { toObjectId } from '../../../infrastructure/database/objectIds';
import type { ExportedPost, PostExportReader } from '../PostExportReader';

interface PostRow {
  createdAt: Date;
  type: ItemType;
  category: ItemCategory;
  title: string;
  place?: string | null;
  location: string;
  occurredOn: Date;
  status: ItemStatus;
  closeReason?: ItemCloseReason | null;
  resolvedAt?: Date | null;
  heldAtSecurityDesk: boolean;
}

/** Reads only the fields the report shows: no reporter, no photos, no questions. */
export class MongoPostExport implements PostExportReader {
  constructor(private readonly connection: Connection) {}

  async postsReported(
    scope: TenantScope,
    period: { from?: Date; until?: Date },
    limit: number,
  ): Promise<ExportedPost[]> {
    const createdAt = {
      ...(period.from ? { $gte: period.from } : {}),
      ...(period.until ? { $lt: period.until } : {}),
    };
    const rows = await this.connection
      .collection<PostRow>('items')
      .find(
        {
          universityId: toObjectId(scope.universityId),
          ...(period.from || period.until ? { createdAt } : {}),
        },
        {
          projection: {
            _id: 0,
            createdAt: 1,
            type: 1,
            category: 1,
            title: 1,
            place: 1,
            location: 1,
            occurredOn: 1,
            status: 1,
            closeReason: 1,
            resolvedAt: 1,
            heldAtSecurityDesk: 1,
          },
        },
      )
      .sort({ createdAt: 1 })
      .limit(limit)
      .toArray();
    return rows.map((row) => ({
      ...row,
      place: row.place ?? null,
      closeReason: row.closeReason ?? null,
      resolvedAt: row.resolvedAt ?? null,
    }));
  }
}
