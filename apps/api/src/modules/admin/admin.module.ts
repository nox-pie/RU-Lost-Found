import type { AuditLog } from '../../core/audit/AuditTrail';
import type { AppModule } from '../../core/modules/AppModule';
import type { SessionManager } from '../auth/SessionManager';
import type { ItemService } from '../items/item.service';
import type { Kernel } from '../kernel';
import type { ModerationController } from '../moderation/moderation.controller';
import { AdminDashboardService } from './admin-dashboard.service';
import { AdminController } from './admin.controller';
import { createAdminRouter } from './admin.routes';
import { MongoPostExport } from './infrastructure/MongoPostExport';
import { MongoStatsReader } from './infrastructure/MongoStatsReader';
import { UserAdminService } from './user-admin.service';

export function createAdminModule(
  kernel: Kernel,
  deps: {
    sessions: SessionManager;
    itemService: ItemService;
    moderation: ModerationController;
    /** The activity log, read side (the kernel's audit trail only writes). */
    auditLog: AuditLog;
  },
): AppModule {
  const { repositories, connection, clock, http } = kernel;
  const controller = new AdminController(
    new UserAdminService(repositories.users, deps.sessions, clock),
    new AdminDashboardService(
      new MongoStatsReader(connection),
      deps.auditLog,
      repositories.users,
      clock,
    ),
    deps.itemService,
    new MongoPostExport(connection),
  );
  return {
    name: 'admin',
    routes: [
      {
        path: '/admin',
        router: createAdminRouter({
          admin: controller,
          moderation: deps.moderation,
          authenticate: http.authenticate,
          requireAdmin: http.requireAdmin,
        }),
      },
    ],
  };
}
