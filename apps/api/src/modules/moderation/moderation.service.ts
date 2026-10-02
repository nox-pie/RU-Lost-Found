import type { FlagItemInput, ListReportsQuery, ModerateItemInput } from '@ru-lost-found/shared';
import { isModerator, type Actor } from '../../core/domain/Actor';
import type { Clock } from '../../core/domain/Clock';
import type { IdGenerator } from '../../core/domain/IdGenerator';
import { ForbiddenError, NotFoundError } from '../../core/errors/AppError';
import type { PageResult } from '../../core/persistence/Pagination';
import type { TenantScope } from '../../core/persistence/Repository';
import type { UnitOfWork } from '../../core/persistence/UnitOfWork';
import type { Item } from '../items/domain/Item';
import type { ItemRepository } from '../items/domain/ItemRepository';
import type { User } from '../users/domain/User';
import type { UserRepository } from '../users/domain/UserRepository';
import { ModerationReport } from './domain/ModerationReport';
import type { ModerationReportRepository } from './domain/ModerationReportRepository';

export interface ModerationServiceDeps {
  reports: ModerationReportRepository;
  items: ItemRepository;
  users: UserRepository;
  unitOfWork: UnitOfWork;
  ids: IdGenerator;
  clock: Clock;
}

/** A report with everything the review screen shows, loaded in batches (no query per row). */
export interface ReportView {
  report: ModerationReport;
  item: Item | undefined;
  people: ReadonlyMap<string, User>;
}

/** Flagging posts, and the admins' review queue. */
export class ModerationService {
  constructor(private readonly deps: ModerationServiceDeps) {}

  async flag(actor: Actor, scope: TenantScope, itemId: string, input: FlagItemInput) {
    const { items, reports, ids, clock } = this.deps;
    const item = await items.findById(scope, itemId);
    if (!item || item.status === 'REMOVED') throw new NotFoundError('Item');

    const report = ModerationReport.file({
      id: ids.next(),
      universityId: scope.universityId,
      item,
      flaggedBy: actor.userId,
      reason: input.reason,
      details: input.details,
      now: clock.now(),
    });
    await reports.create(report);
    return report;
  }

  async list(scope: TenantScope, query: ListReportsQuery): Promise<PageResult<ReportView>> {
    const page = await this.deps.reports.list(scope, query.status === 'OPEN', query);
    const reports = page.items;
    const items = await this.deps.items.findByIds(
      scope,
      reports.map((r) => r.itemId),
    );
    const people = await this.deps.users.findByIds([
      ...reports.map((r) => r.flaggedBy),
      ...reports.flatMap((r) => (r.resolvedBy ? [r.resolvedBy] : [])),
      ...items.map((i) => i.reporterId),
    ]);
    const itemById = new Map(items.map((item) => [item.id, item]));
    const personById = new Map(people.map((user) => [user.id, user]));
    return {
      items: reports.map((report) => ({
        report,
        item: itemById.get(report.itemId),
        people: personById,
      })),
      nextCursor: page.nextCursor,
    };
  }

  countOpen(scope: TenantScope): Promise<number> {
    return this.deps.reports.countOpen(scope);
  }

  /**
   * Decides every open report on a post at once. Removing the post and closing its reports
   * happen in one transaction; the post's open claims are then closed by the claims module
   * (it reacts to ItemRemoved) and the reporter is told why.
   */
  /**
   * An admin removes a post without waiting for reports (e.g. found in the Posts tab), with a
   * reason for the poster. Any open reports on it are closed as actioned in the same
   * transaction, so the review queue never shows a post that is already gone.
   */
  async removePost(
    actor: Actor,
    scope: TenantScope,
    itemId: string,
    reason: string | null,
  ): Promise<{ resolvedReports: number }> {
    const { reports, items, unitOfWork, clock } = this.deps;
    return unitOfWork.run(async (tx) => {
      const now = clock.now();
      const item = await items.findById(scope, itemId, tx);
      if (!item) throw new NotFoundError('Item');
      if (!isModerator(actor)) throw new ForbiddenError('Only admins can remove posts here.');
      item.remove(actor, now, reason);
      await items.update(item, tx);
      const open = await reports.findOpenForItem(scope, itemId, tx);
      for (const report of open) {
        report.resolve('REMOVE_ITEM', actor, reason, now);
        await reports.update(report, tx);
      }
      return { resolvedReports: open.length };
    });
  }

  async moderateItem(
    actor: Actor,
    scope: TenantScope,
    itemId: string,
    input: ModerateItemInput,
  ): Promise<{ resolved: number }> {
    const { reports, items, unitOfWork, clock } = this.deps;
    const note = input.note ?? null;

    return unitOfWork.run(async (tx) => {
      const now = clock.now();
      const open = await reports.findOpenForItem(scope, itemId, tx);
      if (open.length === 0) throw new NotFoundError('Open report for this post');

      if (input.decision === 'REMOVE_ITEM') {
        const item = await items.findById(scope, itemId, tx);
        // Already removed (e.g. by its reporter): the reports are still closed as actioned.
        if (item && item.status !== 'REMOVED') {
          item.remove(actor, now, note);
          await items.update(item, tx);
        }
      }
      for (const report of open) {
        report.resolve(input.decision, actor, note, now);
        await reports.update(report, tx);
      }
      return { resolved: open.length };
    });
  }
}
