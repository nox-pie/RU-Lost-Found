import { z } from 'zod';
import type { ItemStatus, ItemType } from './enums';
import type { PersonSummaryDto } from './items';

/** Why someone flagged a post. */
export const REPORT_REASONS = ['SPAM', 'INAPPROPRIATE', 'SCAM', 'DUPLICATE', 'OTHER'] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

/** OPEN until an admin decides; then DISMISSED (post kept) or ACTIONED (post removed). */
export const REPORT_STATUSES = ['OPEN', 'DISMISSED', 'ACTIONED'] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export const MODERATION_DECISIONS = ['REMOVE_ITEM', 'DISMISS'] as const;
export type ModerationDecision = (typeof MODERATION_DECISIONS)[number];

export const flagItemSchema = z
  .object({
    reason: z.enum(REPORT_REASONS),
    details: z.string().trim().max(500).optional(),
  })
  .strict()
  .refine((value) => value.reason !== 'OTHER' || (value.details?.length ?? 0) >= 5, {
    path: ['details'],
    message: 'Tell us what is wrong with this post',
  });

export const listReportsQuerySchema = z
  .object({
    /** OPEN: waiting for a decision. RESOLVED: dismissed or actioned. */
    status: z.enum(['OPEN', 'RESOLVED']).default('OPEN'),
    cursor: z.string().max(200).optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  })
  .strict();

/** Decides every open report on one item at once. */
export const moderateItemSchema = z
  .object({
    decision: z.enum(MODERATION_DECISIONS),
    note: z.string().trim().max(500).optional(),
  })
  .strict();

export type FlagItemInput = z.infer<typeof flagItemSchema>;
export type ListReportsQuery = z.infer<typeof listReportsQuerySchema>;
export type ModerateItemInput = z.infer<typeof moderateItemSchema>;

export interface ModerationReportDto {
  id: string;
  reason: ReportReason;
  details: string | null;
  status: ReportStatus;
  flaggedBy: PersonSummaryDto;
  item: {
    id: string;
    title: string;
    type: ItemType;
    status: ItemStatus;
    photoUrl: string | null;
    reporter: PersonSummaryDto;
  };
  resolution: { by: PersonSummaryDto; at: string; note: string | null } | null;
  createdAt: string;
}
