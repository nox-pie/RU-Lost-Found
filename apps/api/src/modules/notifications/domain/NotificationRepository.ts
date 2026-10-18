import type { PageRequest, PageResult } from '../../../core/persistence/Pagination';
import type { Notification } from './Notification';

export interface NotificationRepository {
  /** Stores the notification; returns false if one already exists for the same event and user. */
  add(notification: Notification): Promise<boolean>;
  /** The notification an event already produced for a user, if any. */
  findBySourceEvent(sourceEventId: string, userId: string): Promise<Notification | null>;
  /** Records that the notification's email went out. */
  markEmailed(id: string, at: Date): Promise<void>;
  /** Newest first. */
  listForUser(
    userId: string,
    filter: { unreadOnly: boolean },
    page: PageRequest,
  ): Promise<PageResult<Notification>>;
  countUnread(userId: string): Promise<number>;
  /** Marks the given notifications (or all when `ids` is undefined) as read. Returns how many changed. */
  markRead(userId: string, ids: readonly string[] | undefined, now: Date): Promise<number>;
  /** Deletes all of a user's notifications (their account was deleted). */
  deleteAllForUser(userId: string): Promise<number>;
}
