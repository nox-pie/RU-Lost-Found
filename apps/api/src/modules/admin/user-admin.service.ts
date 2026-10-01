import type { ListUsersQuery, Role } from '@ru-lost-found/shared';
import type { Actor } from '../../core/domain/Actor';
import type { Clock } from '../../core/domain/Clock';
import { NotFoundError } from '../../core/errors/AppError';
import type { PageResult } from '../../core/persistence/Pagination';
import type { TenantScope } from '../../core/persistence/Repository';
import type { SessionManager } from '../auth/SessionManager';
import type { User } from '../users/domain/User';
import type { UserRepository } from '../users/domain/UserRepository';

/**
 * What admins do to accounts. The rules (who may manage whom, which roles they may give) live
 * in the User aggregate and RolePolicy; this service loads, saves and ends sessions.
 */
export class UserAdminService {
  constructor(
    private readonly users: UserRepository,
    private readonly sessions: SessionManager,
    private readonly clock: Clock,
  ) {}

  list(scope: TenantScope, query: ListUsersQuery): Promise<PageResult<User>> {
    return this.users.search(
      scope,
      { text: query.q, role: query.role, status: query.status },
      { cursor: query.cursor, limit: query.limit },
    );
  }

  async changeRole(actor: Actor, scope: TenantScope, userId: string, role: Role): Promise<User> {
    const user = await this.load(scope, userId);
    user.changeRole(role, actor, this.clock.now());
    await this.users.update(user);
    return user;
  }

  /**
   * Blocks sign-in and signs the user out everywhere. If ending the sessions failed after the
   * save, they would still end at the next refresh, which checks the account status.
   */
  async suspend(actor: Actor, scope: TenantScope, userId: string, reason: string): Promise<User> {
    const user = await this.load(scope, userId);
    user.suspend(reason, actor, this.clock.now());
    await this.users.update(user);
    await this.sessions.endAll(user.id, 'ACCOUNT_INACTIVE');
    return user;
  }

  async reactivate(actor: Actor, scope: TenantScope, userId: string): Promise<User> {
    const user = await this.load(scope, userId);
    user.reactivate(actor, this.clock.now());
    await this.users.update(user);
    return user;
  }

  /** Users are looked up platform-wide by id, so the university is checked here. */
  private async load(scope: TenantScope, userId: string): Promise<User> {
    const user = await this.users.findById(userId);
    if (!user || user.universityId !== scope.universityId) throw new NotFoundError('User');
    return user;
  }
}
