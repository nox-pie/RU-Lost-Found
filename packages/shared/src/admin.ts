import { z } from 'zod';
import { AUDIT_ACTIONS, type AuditAction, type AuditTargetType } from './audit';
import {
  ROLES,
  USER_STATUSES,
  type ClaimStatus,
  type ItemStatus,
  type Role,
  type UserStatus,
} from './enums';
import type { PersonSummaryDto } from './items';

const objectIdSchema = z.string().regex(/^[0-9a-f]{24}$/i, 'Invalid id');

export const userIdParamsSchema = z.object({ id: objectIdSchema });

export const listUsersQuerySchema = z
  .object({
    /** Start of a first name, last name or email address. */
    q: z.string().trim().min(1).max(100).optional(),
    role: z.enum(ROLES).optional(),
    status: z.enum(USER_STATUSES).optional(),
    cursor: z.string().max(200).optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  })
  .strict();

export const changeRoleSchema = z.object({ role: z.enum(ROLES) }).strict();

export const suspendUserSchema = z
  .object({ reason: z.string().trim().min(5, 'Give a short reason').max(500) })
  .strict();

export const listAuditQuerySchema = z
  .object({
    action: z.enum(AUDIT_ACTIONS).optional(),
    actorId: objectIdSchema.optional(),
    targetId: z.string().trim().min(1).max(64).optional(),
    cursor: z.string().max(200).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .strict();

export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
export type ChangeRoleInput = z.infer<typeof changeRoleSchema>;
export type SuspendUserInput = z.infer<typeof suspendUserSchema>;
export type ListAuditQuery = z.infer<typeof listAuditQuerySchema>;

/** A user as administrators see them. */
export interface AdminUserDto {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  role: Role;
  status: UserStatus;
  school: string;
  year: number;
  enrollmentNumber: string;
  createdAt: string;
}

export interface AuditEntryDto {
  id: string;
  action: AuditAction;
  /** Null for the system (scheduled jobs) or someone not signed in. */
  actor: PersonSummaryDto | null;
  targetType: AuditTargetType;
  targetId: string | null;
  metadata: Record<string, unknown>;
  ip: string | null;
  occurredAt: string;
}

export interface UniversityStatsDto {
  generatedAt: string;
  users: {
    total: number;
    suspended: number;
    byRole: Record<Role, number>;
    joinedLast30Days: number;
  };
  items: {
    byStatus: Record<ItemStatus, number>;
    lost: number;
    found: number;
    reportedLast30Days: number;
    returnedLast30Days: number;
    /** Returned ÷ all posts that weren't removed; null when there are none. */
    recoveryRate: number | null;
    /** Average days from posting to handover, over returned items; null when there are none. */
    averageDaysToReturn: number | null;
  };
  claims: { byStatus: Record<ClaimStatus, number> };
  moderation: { openReports: number };
  /** Oldest first: the last 8 weeks, each starting on Monday (UTC). */
  weekly: { weekStart: string; reported: number; returned: number }[];
}
