import type { Clock } from '../../core/domain/Clock';
import type { Logger } from '../../core/logger/logger';
import { normalizeEmail, type User } from './domain/User';
import type { UserRepository } from './domain/UserRepository';

/**
 * The deployment owner's accounts (ADMIN_EMAILS): always platform admins. Saves running the
 * set-role script by hand after a fresh deploy, and records who owns the deployment in its
 * configuration instead of in someone's memory. Each appointment is audited like any other.
 */
export class AdminAccounts {
  private readonly emails: ReadonlySet<string>;

  constructor(
    emails: readonly string[],
    private readonly users: UserRepository,
    private readonly clock: Clock,
    private readonly logger: Logger,
  ) {
    this.emails = new Set(emails.map(normalizeEmail));
  }

  /** For a new account, before it is saved: a listed email starts as platform admin. */
  applyTo(user: User): void {
    if (this.emails.has(user.email)) user.appointBySystem('PLATFORM_ADMIN', this.clock.now());
  }

  /** At startup, for accounts that already exist. Returns how many were appointed. */
  async ensure(): Promise<number> {
    let appointed = 0;
    for (const email of this.emails) {
      const user = await this.users.findByEmail(email);
      if (!user || user.role === 'PLATFORM_ADMIN') continue;
      user.appointBySystem('PLATFORM_ADMIN', this.clock.now());
      await this.users.update(user);
      appointed += 1;
    }
    if (appointed > 0)
      this.logger.info({ appointed }, 'Appointed platform admins from ADMIN_EMAILS');
    return appointed;
  }
}
