import type { AuditTrail } from '../../core/audit/AuditTrail';
import type { AppModule } from '../../core/modules/AppModule';
import { AuditEventHandler } from './AuditEventHandler';

/** Writes the activity log from domain events (the log itself is shared through the kernel). */
export function createAuditModule(audit: AuditTrail): AppModule {
  return { name: 'audit', handlers: [new AuditEventHandler(audit)] };
}
