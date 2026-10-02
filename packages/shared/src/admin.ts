import { z } from 'zod';
import { AUDIT_ACTIONS, type AuditAction, type AuditTargetType } from './audit';
import {
  ITEM_CATEGORIES,
  ITEM_STATUSES,
  ITEM_TYPES,
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

/** An exact moment, e.g. "2026-10-02T18:30:00.000Z" (the start of 3 October in India). */
const instantSchema = z
  .string()
  .datetime({ offset: true, message: 'Use an ISO 8601 date and time' })
  .transform((value) => new Date(value));

export const listAuditQuerySchema = z
  .object({
    action: z.enum(AUDIT_ACTIONS).optional(),
    actorId: objectIdSchema.optional(),
    targetId: z.string().trim().min(1).max(64).optional(),
    /** Entries at or after this moment. */
    from: instantSchema.optional(),
    /** Entries before this moment (exclusive), e.g. the start of the next day. */
    until: instantSchema.optional(),
    cursor: z.string().max(200).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .strict()
  .refine((query) => !query.from || !query.until || query.from < query.until, {
    path: ['until'],
    message: 'Must be after "from"',
  });

/** Every post of the university, in any status (the admin "Posts" tab). */
export const listAdminItemsQuerySchema = z
  .object({
    q: z.string().trim().min(1).max(100).optional(),
    type: z.enum(ITEM_TYPES).optional(),
    category: z.enum(ITEM_CATEGORIES).optional(),
    /** Comma-separated, e.g. `OPEN,RESERVED`. Every status when absent. */
    status: z
      .string()
      .transform((value) => value.split(',').map((status) => status.trim()))
      .pipe(z.array(z.enum(ITEM_STATUSES)).min(1))
      .optional(),
    cursor: z.string().max(200).optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  })
  .strict();

/** An admin removes a post; the reason is shown to the person who posted it. */
export const removePostSchema = z
  .object({ reason: z.string().trim().max(500).optional() })
  .strict();

export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
export type ChangeRoleInput = z.infer<typeof changeRoleSchema>;
export type SuspendUserInput = z.infer<typeof suspendUserSchema>;
export type ListAuditQuery = z.infer<typeof listAuditQuerySchema>;
export type ListAdminItemsQuery = z.infer<typeof listAdminItemsQuerySchema>;
export type RemovePostInput = z.infer<typeof removePostSchema>;

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
