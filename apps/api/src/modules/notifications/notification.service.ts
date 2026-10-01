import type {
  ListNotificationsQuery,
  MarkNotificationsReadInput,
  NotificationType,
} from '@ru-lost-found/shared';
import type { Clock } from '../../core/domain/Clock';
import type { IdGenerator } from '../../core/domain/IdGenerator';
import type { EmailMessage, EmailSender } from '../../core/email/EmailSender';
import type { PageResult } from '../../core/persistence/Pagination';
import type { User } from '../users/domain/User';
import type { UserRepository } from '../users/domain/UserRepository';
import { Notification } from './domain/Notification';
import type { NotificationRepository } from './domain/NotificationRepository';

export interface NotifyInput {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  claimId?: string;
  itemId?: string;
  /** The event being handled; makes the notification idempotent. */
  sourceEventId: string;
  /** Optional email to send as well, built once the recipient is known. */
  email?: (recipient: User) => EmailMessage;
}

/** Delivers a message to a user: in the app, and optionally by email. */
export class NotificationService {
  constructor(
    private readonly notifications: NotificationRepository,
    private readonly users: UserRepository,
    private readonly emailSender: EmailSender,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async notify(input: NotifyInput): Promise<void> {
    const recipient = await this.users.findById(input.userId);
    if (!recipient) return;

    await this.notifications.add(
      Notification.create({
        id: this.ids.next(),
        userId: recipient.id,
        universityId: recipient.universityId,
        type: input.type,
        title: input.title,
        body: input.body,
        claimId: input.claimId ?? null,
        itemId: input.itemId ?? null,
        sourceEventId: input.sourceEventId,
        createdAt: this.clock.now(),
      }),
    );

    // Sent even if the in-app notification already existed: that happens when an earlier attempt
    // stored it but failed to send the email, so the email is still owed.
    if (input.email && recipient.isActive) {
      await this.emailSender.send(input.email(recipient));
    }
  }

  async list(
    userId: string,
    query: ListNotificationsQuery,
  ): Promise<{ page: PageResult<Notification>; unreadCount: number }> {
    const [page, unreadCount] = await Promise.all([
      this.notifications.listForUser(
        userId,
        { unreadOnly: query.unread },
        { cursor: query.cursor, limit: query.limit },
      ),
      this.notifications.countUnread(userId),
    ]);
    return { page, unreadCount };
  }

  async markRead(userId: string, input: MarkNotificationsReadInput): Promise<number> {
    await this.notifications.markRead(userId, input.ids, this.clock.now());
    return this.notifications.countUnread(userId);
  }
}
