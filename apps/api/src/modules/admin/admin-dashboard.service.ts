import type { ListAuditQuery, UniversityStatsDto } from '@ru-lost-found/shared';
import type { AuditLog, AuditRecord } from '../../core/audit/AuditTrail';
import type { Clock } from '../../core/domain/Clock';
import type { PageResult } from '../../core/persistence/Pagination';
import type { TenantScope } from '../../core/persistence/Repository';
import type { User } from '../users/domain/User';
import type { UserRepository } from '../users/domain/UserRepository';
import type { StatsReader } from './StatsReader';

export interface ActivityPage extends PageResult<AuditRecord> {
  people: ReadonlyMap<string, User>;
}

/** Read-only admin screens: statistics and the activity (audit) log. */
export class AdminDashboardService {
  constructor(
    private readonly stats: StatsReader,
    private readonly auditLog: AuditLog,
    private readonly users: UserRepository,
    private readonly clock: Clock,
  ) {}

  universityStats(scope: TenantScope): Promise<UniversityStatsDto> {
    return this.stats.forUniversity(scope, this.clock.now());
  }

  /** Audit entries with the names of the people involved, loaded in one query. */
  async activity(scope: TenantScope, query: ListAuditQuery): Promise<ActivityPage> {
    const page = await this.auditLog.search(
      scope,
      {
        action: query.action,
        actorId: query.actorId,
        targetId: query.targetId,
        from: query.from,
        until: query.until,
      },
      { cursor: query.cursor, limit: query.limit },
    );
    const actors = await this.users.findByIds(
      page.items.flatMap((entry) => (entry.actorId ? [entry.actorId] : [])),
    );
    return { ...page, people: new Map(actors.map((user) => [user.id, user])) };
  }
}
