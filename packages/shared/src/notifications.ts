import { z } from 'zod';
import type { Page } from './items';

export const NOTIFICATION_TYPES = [
  'CLAIM_RECEIVED',
  'CLAIM_APPROVED',
  'CLAIM_REJECTED',
  'CLAIM_CANCELLED',
  'HANDOVER_COMPLETED',
  'CLAIM_EXPIRED',
  'ITEM_REMOVED_BY_MODERATOR',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const listNotificationsQuerySchema = z
  .object({
    unread: z
      .enum(['true', 'false'])
      .transform((value) => value === 'true')
      .default('false'),
    cursor: z.string().max(200).optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  })
  .strict();

export const markNotificationsReadSchema = z
  .object({
    /** Notifications to mark as read; all of the user's notifications when absent. */
    ids: z
      .array(z.string().regex(/^[0-9a-f]{24}$/i, 'Invalid id'))
      .min(1)
      .max(100)
      .optional(),
  })
  .strict();

export type ListNotificationsQuery = z.infer<typeof listNotificationsQuerySchema>;
export type MarkNotificationsReadInput = z.infer<typeof markNotificationsReadSchema>;

export interface NotificationDto {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  link: { claimId: string | null; itemId: string | null };
  read: boolean;
  createdAt: string;
}

export interface NotificationPage extends Page<NotificationDto> {
  unreadCount: number;
}
