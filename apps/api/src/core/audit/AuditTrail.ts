import type { AuditAction, AuditTargetType } from '@ru-lost-found/shared';
import type { PageRequest, PageResult } from '../persistence/Pagination';
import type { TenantScope } from '../persistence/Repository';

export interface AuditEntry {
  action: AuditAction;
  /** Who did it; null for the system (scheduled jobs) or an unknown person (failed login). */
  actorId: string | null;
  universityId: string | null;
  targetType: AuditTargetType;
  targetId: string | null;
  occurredAt: Date;
  /** Small, non-secret details (never passwords, codes or tokens). */
  metadata?: Record<string, unknown>;
  ip?: string | null;
  /** The domain event this entry came from, if any; makes recording idempotent. */
  sourceEventId?: string;
}

/**
 * Append-only record of security-relevant actions: who did what to which record, and when.
 * Entries are never updated; they expire after the retention period.
 */
export interface AuditTrail {
  /** Throws on failure (event handlers rely on this to retry). */
  record(entry: AuditEntry): Promise<void>;
  /** Never throws: used inside user requests, which must not fail because auditing did. */
  recordSafely(entry: AuditEntry): Promise<void>;
}

/** A stored audit entry, as the admin activity screen reads it. */
export interface AuditRecord {
  id: string;
  action: AuditAction;
  actorId: string | null;
  targetType: AuditTargetType;
  targetId: string | null;
  occurredAt: Date;
  metadata: Record<string, unknown>;
  ip: string | null;
}

export interface AuditLogFilter {
  action?: AuditAction;
  actorId?: string;
  targetId?: string;
  /** At or after. */
  from?: Date;
  /** Before (exclusive). */
  until?: Date;
}

/** Read side of the audit trail: one university's entries, newest first. */
export interface AuditLog {
  search(
    scope: TenantScope,
    filter: AuditLogFilter,
    page: PageRequest,
  ): Promise<PageResult<AuditRecord>>;
}
