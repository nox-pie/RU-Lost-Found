import { z } from 'zod';
import type { EventHandler, StoredEvent } from '../../../core/events/EventHandler';
import type { ItemRepository } from '../../items/domain/ItemRepository';
import type { NotificationEmails } from '../notification.emails';
import type { NotificationService } from '../notification.service';

const payload = z.object({
  universityId: z.string(),
  byModerator: z.boolean().optional(),
  reason: z.string().nullable().optional(),
});

/** Tells reporters when an admin removes their post, and why. */
export class ItemModerationHandler implements EventHandler {
  readonly name = 'item-moderation-notifications';
  readonly handles = ['ItemRemoved'] as const;

  constructor(
    private readonly notifications: NotificationService,
    private readonly items: ItemRepository,
    private readonly emails: NotificationEmails,
  ) {}

  async handle(event: StoredEvent): Promise<void> {
    const p = payload.parse(event.payload);
    if (!p.byModerator) return;
    const item = await this.items.findById({ universityId: p.universityId }, event.aggregateId);
    if (!item) return;

    const body = [
      `An administrator removed your post “${item.title}”, so it no longer appears to others and its open claims were closed.`,
      ...(p.reason ? [`Reason: ${p.reason}`] : []),
    ];
    await this.notifications.notify({
      userId: item.reporterId,
      type: 'ITEM_REMOVED_BY_MODERATOR',
      title: 'Your post was removed',
      body: body.join(' '),
      sourceEventId: event.id,
      email: (recipient) =>
        this.emails.compose({
          to: recipient.email,
          firstName: recipient.profile.firstName,
          subject: 'Your post was removed',
          heading: 'Your post was removed',
          paragraphs: body,
          action: { label: 'See your posts', path: '/my-items' },
        }),
    });
  }
}
