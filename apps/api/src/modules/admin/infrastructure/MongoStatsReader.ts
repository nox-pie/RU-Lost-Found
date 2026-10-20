import {
  CLAIM_STATUSES,
  ITEM_STATUSES,
  ROLES,
  type ItemCategory,
  type UniversityStatsDto,
} from '@ru-lost-found/shared';
import type { Connection } from 'mongoose';
import type { TenantScope } from '../../../core/persistence/Repository';
import { toObjectId } from '../../../infrastructure/database/objectIds';
import type { StatsReader } from '../StatsReader';

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKS = 8;

type Counted = { _id: string | Date | null; n: number };

/** Turns `[{ _id: 'OPEN', n: 3 }]` into `{ OPEN: 3, RESERVED: 0, ... }`. */
function countsByKey<K extends string>(
  keys: readonly K[],
  rows: Counted[] = [],
): Record<K, number> {
  const counts = Object.fromEntries(keys.map((key) => [key, 0])) as Record<K, number>;
  for (const row of rows) {
    if (typeof row._id === 'string' && row._id in counts) counts[row._id as K] = row.n;
  }
  return counts;
}

const first = (rows: { n: number }[] = []) => rows[0]?.n ?? 0;

/** Monday 00:00 UTC of the week containing `date`. */
function startOfWeek(date: Date): Date {
  const day = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const sinceMonday = (day.getUTCDay() + 6) % 7;
  return new Date(day.getTime() - sinceMonday * DAY_MS);
}

const byWeek = (field: string) => [
  {
    $group: {
      _id: { $dateTrunc: { date: `$${field}`, unit: 'week', startOfWeek: 'monday' } },
      n: { $sum: 1 },
    },
  },
];

type BreakdownRow = { _id: string | null; lost: number; found: number; returned: number };

const countWhere = (condition: object) => ({ $sum: { $cond: [condition, 1, 0] } });

/** Lost, found and returned posts per value of `key`, removed posts aside. */
const breakdownBy = (key: unknown) => [
  { $match: { status: { $ne: 'REMOVED' } } },
  {
    $group: {
      _id: key,
      lost: countWhere({ $eq: ['$type', 'LOST'] }),
      found: countWhere({ $eq: ['$type', 'FOUND'] }),
      returned: countWhere({ $eq: ['$status', 'RESOLVED'] }),
    },
  },
];

/** Biggest first, then by name; posts without a value (no place) last. */
function sortBreakdown(rows: BreakdownRow[] = []): BreakdownRow[] {
  return [...rows].sort(
    (a, b) =>
      Number(a._id === null) - Number(b._id === null) ||
      b.lost + b.found - (a.lost + a.found) ||
      String(a._id).localeCompare(String(b._id)),
  );
}

/** One aggregation per collection, each split into several counts with $facet. */
export class MongoStatsReader implements StatsReader {
  constructor(private readonly connection: Connection) {}

  async forUniversity(scope: TenantScope, now: Date): Promise<UniversityStatsDto> {
    const universityId = toObjectId(scope.universityId);
    const since30Days = new Date(now.getTime() - 30 * DAY_MS);
    const firstWeek = new Date(startOfWeek(now).getTime() - (WEEKS - 1) * 7 * DAY_MS);
    const db = this.connection;

    const [[users], [items], [claims], openReports] = await Promise.all([
      db
        .collection('users')
        .aggregate<{ byRole: Counted[]; suspended: { n: number }[]; recent: { n: number }[] }>([
          { $match: { universityId } },
          {
            $facet: {
              byRole: [{ $group: { _id: '$role', n: { $sum: 1 } } }],
              suspended: [{ $match: { status: 'SUSPENDED' } }, { $count: 'n' }],
              recent: [{ $match: { createdAt: { $gte: since30Days } } }, { $count: 'n' }],
            },
          },
        ])
        .toArray(),
      db
        .collection('items')
        .aggregate<{
          byStatus: Counted[];
          byType: Counted[];
          reported: { n: number }[];
          returned: { n: number }[];
          timeToReturn: { avgMs: number | null }[];
          weeklyReported: Counted[];
          weeklyReturned: Counted[];
          byCategory: BreakdownRow[];
          byPlace: BreakdownRow[];
        }>([
          { $match: { universityId } },
          {
            $facet: {
              byStatus: [{ $group: { _id: '$status', n: { $sum: 1 } } }],
              byType: [
                { $match: { status: { $ne: 'REMOVED' } } },
                { $group: { _id: '$type', n: { $sum: 1 } } },
              ],
              reported: [{ $match: { createdAt: { $gte: since30Days } } }, { $count: 'n' }],
              returned: [{ $match: { resolvedAt: { $gte: since30Days } } }, { $count: 'n' }],
              timeToReturn: [
                { $match: { status: 'RESOLVED', resolvedAt: { $ne: null } } },
                {
                  $group: {
                    _id: null,
                    avgMs: { $avg: { $subtract: ['$resolvedAt', '$createdAt'] } },
                  },
                },
              ],
              weeklyReported: [
                { $match: { createdAt: { $gte: firstWeek } } },
                ...byWeek('createdAt'),
              ],
              weeklyReturned: [
                { $match: { resolvedAt: { $gte: firstWeek } } },
                ...byWeek('resolvedAt'),
              ],
              byCategory: breakdownBy('$category'),
              byPlace: breakdownBy({ $ifNull: ['$place', null] }),
            },
          },
        ])
        .toArray(),
      db
        .collection('claims')
        .aggregate<{
          byStatus: Counted[];
        }>([
          { $match: { universityId } },
          { $facet: { byStatus: [{ $group: { _id: '$status', n: { $sum: 1 } } }] } },
        ])
        .toArray(),
      db.collection('moderation_reports').countDocuments({ universityId, status: 'OPEN' }),
    ]);

    const byRole = countsByKey(ROLES, users?.byRole);
    const itemsByStatus = countsByKey(ITEM_STATUSES, items?.byStatus);
    const byType = countsByKey(['LOST', 'FOUND'] as const, items?.byType);
    // Every post that wasn't removed; closed ones too, or posts nobody followed up on would
    // flatter the rate.
    const live =
      itemsByStatus.OPEN + itemsByStatus.RESERVED + itemsByStatus.RESOLVED + itemsByStatus.CLOSED;
    const avgMs = items?.timeToReturn[0]?.avgMs ?? null;

    const weekCount = (rows: Counted[] = [], week: Date) =>
      rows.find((row) => row._id instanceof Date && row._id.getTime() === week.getTime())?.n ?? 0;

    return {
      generatedAt: now.toISOString(),
      users: {
        total: Object.values(byRole).reduce((sum, n) => sum + n, 0),
        suspended: first(users?.suspended),
        byRole,
        joinedLast30Days: first(users?.recent),
      },
      items: {
        byStatus: itemsByStatus,
        lost: byType.LOST,
        found: byType.FOUND,
        reportedLast30Days: first(items?.reported),
        returnedLast30Days: first(items?.returned),
        recoveryRate: live > 0 ? itemsByStatus.RESOLVED / live : null,
        averageDaysToReturn: avgMs === null ? null : Math.round((avgMs / DAY_MS) * 10) / 10,
      },
      claims: { byStatus: countsByKey(CLAIM_STATUSES, claims?.byStatus) },
      moderation: { openReports },
      weekly: Array.from({ length: WEEKS }, (_, index) => {
        const week = new Date(firstWeek.getTime() + index * 7 * DAY_MS);
        return {
          weekStart: week.toISOString().slice(0, 10),
          reported: weekCount(items?.weeklyReported, week),
          returned: weekCount(items?.weeklyReturned, week),
        };
      }),
      breakdown: {
        byCategory: sortBreakdown(items?.byCategory).map(({ _id, lost, found, returned }) => ({
          category: _id as ItemCategory,
          lost,
          found,
          returned,
        })),
        byPlace: sortBreakdown(items?.byPlace).map(({ _id, lost, found, returned }) => ({
          place: _id,
          lost,
          found,
          returned,
        })),
      },
    };
  }
}
