import type { PageRequest, PageResult } from '../../../core/persistence/Pagination';
import type { Notification } from './Notification';

export interface NotificationRepository {
  /** Stores the notification; returns false if one already exists for the same event and user. */
  add(notification: Notification): Promise<boolean>;
  /** Newest first. */
  listForUser(
    userId: string,
    filter: { unreadOnly: boolean },
    page: PageRequest,
  ): Promise<PageResult<Notification>>;
  countUnread(userId: string): Promise<number>;
  /** Marks the given notifications (or all when `ids` is undefined) as read. Returns how many changed. */
  markRead(userId: string, ids: readonly string[] | undefined, now: Date): Promise<number>;
}
