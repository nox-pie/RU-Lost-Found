import type { Request, RequestHandler } from 'express';
import type {
  ExportPostsQuery,
  AdminUserDto,
  AuditEntryDto,
  ChangeRoleInput,
  ItemDto,
  ListAdminItemsQuery,
  ListAuditQuery,
  ListUsersQuery,
  Page,
  SuspendUserInput,
} from '@ru-lost-found/shared';
import { actorOf, authOf, scopeOf } from '../../core/http/auth';
import { toItemDto } from '../items/item.mapper';
import type { ItemService } from '../items/item.service';
import { toAdminUserDto, toAuditEntryDto } from './admin.mapper';
import type { AdminDashboardService } from './admin-dashboard.service';
import type { UserAdminService } from './user-admin.service';
import type { PostExportReader } from './PostExportReader';
import { postsCsv } from './postsCsv';

/** Rows in one export: years of posts for a university, far below what a spreadsheet takes. */
const EXPORT_LIMIT = 20_000;

const idOf = (req: Request) => (req.params as { id: string }).id;

export class AdminController {
  constructor(
    private readonly users: UserAdminService,
    private readonly dashboard: AdminDashboardService,
    private readonly items: ItemService,
    private readonly exports: PostExportReader,
  ) {}

  listItems: RequestHandler = async (req, res) => {
    const page = await this.items.listAll(
      scopeOf(req),
      req.query as unknown as ListAdminItemsQuery,
    );
    const viewerId = authOf(req).userId;
    res.json({
      data: page.items.map((view) => toItemDto(view, viewerId)),
      nextCursor: page.nextCursor,
    } satisfies Page<ItemDto>);
  };

  /** The posts reported in a period, as a CSV file named after it. */
  exportPosts: RequestHandler = async (req, res) => {
    const { from, until } = req.query as unknown as ExportPostsQuery;
    const posts = await this.exports.postsReported(scopeOf(req), { from, until }, EXPORT_LIMIT);
    const day = (date: Date | undefined, fallback: string) =>
      date ? date.toISOString().slice(0, 10) : fallback;
    res
      .attachment(`posts-${day(from, 'start')}-to-${day(until, 'now')}.csv`)
      .type('text/csv; charset=utf-8')
      .send(postsCsv(posts));
  };

  stats: RequestHandler = async (req, res) => {
    res.json(await this.dashboard.universityStats(scopeOf(req)));
  };

  listUsers: RequestHandler = async (req, res) => {
    const page = await this.users.list(scopeOf(req), req.query as unknown as ListUsersQuery);
    res.json({
      data: page.items.map(toAdminUserDto),
      nextCursor: page.nextCursor,
    } satisfies Page<AdminUserDto>);
  };

  changeRole: RequestHandler = async (req, res) => {
    const { role } = req.body as ChangeRoleInput;
    const user = await this.users.changeRole(actorOf(req), scopeOf(req), idOf(req), role);
    res.json(toAdminUserDto(user));
  };

  suspend: RequestHandler = async (req, res) => {
    const { reason } = req.body as SuspendUserInput;
    const user = await this.users.suspend(actorOf(req), scopeOf(req), idOf(req), reason);
    res.json(toAdminUserDto(user));
  };

  reactivate: RequestHandler = async (req, res) => {
    const user = await this.users.reactivate(actorOf(req), scopeOf(req), idOf(req));
    res.json(toAdminUserDto(user));
  };

  activity: RequestHandler = async (req, res) => {
    const page = await this.dashboard.activity(
      scopeOf(req),
      req.query as unknown as ListAuditQuery,
    );
    res.json({
      data: page.items.map((entry) => toAuditEntryDto(entry, page.people)),
      nextCursor: page.nextCursor,
    } satisfies Page<AuditEntryDto>);
  };
}
