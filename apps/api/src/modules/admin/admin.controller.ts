import type { Request, RequestHandler } from 'express';
import type {
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

const idOf = (req: Request) => (req.params as { id: string }).id;

export class AdminController {
  constructor(
    private readonly users: UserAdminService,
    private readonly dashboard: AdminDashboardService,
    private readonly items: ItemService,
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
