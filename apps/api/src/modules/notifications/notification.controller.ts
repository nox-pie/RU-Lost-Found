import type { RequestHandler } from 'express';
import type {
  ListNotificationsQuery,
  MarkNotificationsReadInput,
  NotificationDto,
  NotificationPage,
} from '@ru-lost-found/shared';
import { authOf } from '../../core/http/auth';
import type { Notification } from './domain/Notification';
import type { NotificationService } from './notification.service';

function toNotificationDto(notification: Notification): NotificationDto {
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

export class NotificationController {
  constructor(private readonly notifications: NotificationService) {}

  list: RequestHandler = async (req, res) => {
    const { page, unreadCount } = await this.notifications.list(
      authOf(req).userId,
      req.query as unknown as ListNotificationsQuery,
    );
    const body: NotificationPage = {
      data: page.items.map(toNotificationDto),
      nextCursor: page.nextCursor,
      unreadCount,
    };
    res.json(body);
  };

  markRead: RequestHandler = async (req, res) => {
    const unreadCount = await this.notifications.markRead(
      authOf(req).userId,
      req.body as MarkNotificationsReadInput,
    );
    res.json({ unreadCount });
  };
}
