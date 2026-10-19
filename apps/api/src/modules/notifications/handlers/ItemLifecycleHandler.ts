import type { EventHandler, StoredEvent } from '../../../core/events/EventHandler';
import { payloadOf, type DomainEventType } from '../../events';
import type { ItemRepository } from '../../items/domain/ItemRepository';
import type { NotificationEmails } from '../notification.emails';
import type { NotificationService } from '../notification.service';

const formatDay = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    timeZone: 'Asia/Kolkata',
  });

/**
 * Tells reporters about the end of an open post: a week before it closes (in the app and by
 * email, with a way to keep it open), and when it closed by itself (in the app only).
 */
export class ItemLifecycleHandler implements EventHandler {
  readonly name = 'item-lifecycle-notifications';
  readonly handles = [
    'ItemExpiringSoon',
    'ItemClosed',
  ] as const satisfies readonly DomainEventType[];

  constructor(
    private readonly notifications: NotificationService,
    private readonly items: ItemRepository,
    private readonly emails: NotificationEmails,
  ) {}

  async handle(event: StoredEvent): Promise<void> {
    if (event.type === 'ItemExpiringSoon') {
      const { universityId, reporterId, expiresAt } = payloadOf(event, 'ItemExpiringSoon');
      const item = await this.items.findById({ universityId }, event.aggregateId);
      if (!item) return;
      const subject = `Still looking for “${item.title}”?`;
      const body = `Your post closes on ${formatDay(expiresAt)}. If it still matters, keep it open; if it's sorted, close it yourself.`;
      await this.notifications.notify({
        userId: reporterId,
        type: 'POST_EXPIRING',
        title: subject,
        body,
        itemId: item.id,
        sourceEventId: event.id,
        email: (recipient) =>
          this.emails.compose({
            to: recipient.email,
            firstName: recipient.profile.firstName,
            subject,
            heading: subject,
            paragraphs: [body],
            action: { label: 'Open your post', path: `/items/${item.id}` },
          }),
      });
      return;
    }

    const { universityId, reporterId, reason } = payloadOf(event, 'ItemClosed');
    // The reporter closed it themselves: nothing to tell them.
    if (reason !== 'EXPIRED') return;
    const item = await this.items.findById({ universityId }, event.aggregateId);
    if (!item) return;
    await this.notifications.notify({
      userId: reporterId,
      type: 'POST_CLOSED',
      title: 'Your post was closed',
      body: `“${item.title}” was closed because nobody kept it open. You can open it again from the post.`,
      itemId: item.id,
      sourceEventId: event.id,
    });
  }
}
