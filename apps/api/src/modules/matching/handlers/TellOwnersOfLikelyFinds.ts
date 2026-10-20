import type { EventHandler, StoredEvent } from '../../../core/events/EventHandler';
import { payloadOf, type DomainEventType } from '../../events';
import type { ItemRepository } from '../../items/domain/ItemRepository';
import type { NotificationEmails } from '../../notifications/notification.emails';
import type { NotificationService } from '../../notifications/notification.service';
import type { MatchingService } from '../matching.service';

/** At most this many owners are told about one found post (a vague post matches widely). */
const MAX_TOLD = 3;

/**
 * When a found item is posted, the owners of the lost posts it strongly matches are told, in
 * the app and by email, so an item can find its owner without them searching.
 */
export class TellOwnersOfLikelyFinds implements EventHandler {
  readonly name = 'tell-owners-of-likely-finds';
  readonly handles = ['ItemReported'] as const satisfies readonly DomainEventType[];

  constructor(
    private readonly matching: MatchingService,
    private readonly items: ItemRepository,
    private readonly notifications: NotificationService,
    private readonly emails: NotificationEmails,
  ) {}

  async handle(event: StoredEvent): Promise<void> {
    const { universityId, itemType } = payloadOf(event, 'ItemReported');
    if (itemType !== 'FOUND') return;
    const scope = { universityId };
    const found = await this.items.findById(scope, event.aggregateId);
    if (!found) return;

    const matches = (await this.matching.strongMatchesFor(scope, found)).slice(0, MAX_TOLD);
    for (const { item: lost } of matches) {
      const title = `Someone may have found your “${lost.title}”`;
      const body = `A new found post, “${found.title}”, looks like your lost item. Check its photos, then claim it if it is yours.`;
      await this.notifications.notify({
        userId: lost.reporterId,
        type: 'POSSIBLE_MATCH',
        title,
        body,
        itemId: found.id,
        sourceEventId: event.id,
        email: (recipient) =>
          this.emails.compose({
            to: recipient.email,
            firstName: recipient.profile.firstName,
            subject: title,
            heading: title,
            paragraphs: [body],
            action: { label: 'See the post', path: `/items/${found.id}` },
          }),
      });
    }
  }
}
