import type { NotificationDto } from '@ru-lost-found/shared';
import type { Notification } from './domain/Notification';

export function toNotificationDto(notification: Notification): NotificationDto {
  return {
    id: notification.id,
    type: notification.type,
    title: notification.title,
    body: notification.body,
    link: { claimId: notification.claimId, itemId: notification.itemId },
    read: notification.isRead,
    createdAt: notification.createdAt.toISOString(),
  };
}
