import type { Connection } from 'mongoose';
import type { Logger } from '../../core/logger/logger';
import type { ItemRepository } from '../../modules/items/domain/ItemRepository';
import type { University } from '../../modules/universities/domain/University';
import type { UserRepository } from '../../modules/users/domain/UserRepository';
import { mapItem, mapUser, type LegacyItem, type LegacyUser } from './legacyMapping';

export interface MigrationReport {
  dryRun: boolean;
  users: { read: number; migrated: number; alreadyThere: number; skipped: Record<string, number> };
  items: { read: number; migrated: number; alreadyThere: number; skipped: Record<string, number> };
  /** Old "claimed by" contact notes, deliberately not copied (personal data, no consent). */
  claimNotesDropped: number;
}

function count(skipped: Record<string, number>, reason: string) {
  skipped[reason] = (skipped[reason] ?? 0) + 1;
}

/**
 * Copies accounts and items from the first version's database into this one.
 *
 * - Safe to run again: records that already exist (same id, or same email) are left alone.
 * - Dry run by default: everything is read and checked, nothing is written.
 * - Writes go straight to the repositories, without domain events, so nobody gets an email or
 *   notification about records that are only being moved.
 */
export class LegacyMigration {
  constructor(
    private readonly legacy: Connection,
    private readonly target: { users: UserRepository; items: ItemRepository },
    private readonly university: University,
    private readonly logger: Logger,
  ) {}

  async run(options: { apply: boolean }): Promise<MigrationReport> {
    const report: MigrationReport = {
      dryRun: !options.apply,
      users: { read: 0, migrated: 0, alreadyThere: 0, skipped: {} },
      items: { read: 0, migrated: 0, alreadyThere: 0, skipped: {} },
      claimNotesDropped: 0,
    };
    /** Old account id → account id here (the same, unless they had already signed up again). */
    const accounts = new Map<string, string>();

    for await (const doc of this.legacy.collection<LegacyUser>('users').find()) {
      report.users.read += 1;
      const mapped = mapUser(doc, this.university);
      if ('skip' in mapped) {
        count(report.users.skipped, mapped.skip);
        continue;
      }
      const user = mapped.ok;
      const existing =
        (await this.target.users.findById(user.id)) ??
        (await this.target.users.findByEmail(user.email));
      if (existing) {
        report.users.alreadyThere += 1;
        accounts.set(user.id, existing.id);
        continue;
      }
      if (options.apply) await this.target.users.create(user);
      accounts.set(user.id, user.id);
      report.users.migrated += 1;
    }

    const scope = { universityId: this.university.id };
    for await (const doc of this.legacy.collection<LegacyItem>('items').find()) {
      report.items.read += 1;
      if (doc.claimedBy && Object.values(doc.claimedBy).some(Boolean))
        report.claimNotesDropped += 1;
      const reporterId = accounts.get(doc.reporterId?.toHexString?.() ?? '');
      if (!reporterId) {
        count(report.items.skipped, 'its reporter was not migrated');
        continue;
      }
      const mapped = mapItem(doc, this.university.id, reporterId);
      if ('skip' in mapped) {
        count(report.items.skipped, mapped.skip);
        continue;
      }
      if (await this.target.items.findById(scope, mapped.ok.id)) {
        report.items.alreadyThere += 1;
        continue;
      }
      if (options.apply) await this.target.items.create(mapped.ok);
      report.items.migrated += 1;
    }

    this.logger.info({ report }, options.apply ? 'Migration finished' : 'Dry run finished');
    return report;
  }
}
