import type { UniversityStatsDto } from '@ru-lost-found/shared';
import type { TenantScope } from '../../core/persistence/Repository';

/**
 * Read model for the admin dashboard. Counting is done by the database (aggregations), not by
 * loading domain objects: this side only reads, so it can be shaped purely for the screen.
 */
export interface StatsReader {
  forUniversity(scope: TenantScope, now: Date): Promise<UniversityStatsDto>;
}
