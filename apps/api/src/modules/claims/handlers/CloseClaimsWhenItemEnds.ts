import type { EventHandler, StoredEvent } from '../../../core/events/EventHandler';
import { payloadOf, type DomainEventType } from '../../events';
import type { ClaimService } from '../claim.service';

/**
 * Items and claims live in separate modules. When an item is removed, or its reporter closes
 * it, the items module doesn't call the claims module; the claims module reacts to the event
 * instead, and the note says why (the claimants are told, see ClaimNotificationHandler).
 */
export class CloseClaimsWhenItemEnds implements EventHandler {
  readonly name = 'close-claims-when-item-ends';
  readonly handles = ['ItemRemoved', 'ItemClosed'] as const satisfies readonly DomainEventType[];

  constructor(private readonly claims: ClaimService) {}

  async handle(event: StoredEvent): Promise<void> {
    if (event.type === 'ItemRemoved') {
      const { universityId } = payloadOf(event, 'ItemRemoved');
      await this.claims.closeClaimsOfItem(
        { universityId },
        event.aggregateId,
        'The item was removed.',
      );
      return;
    }
    const { universityId, reason } = payloadOf(event, 'ItemClosed');
    const note =
      reason === 'EXPIRED'
        ? 'The post closed after nobody kept it open.'
        : 'The post was closed by its reporter.';
    await this.claims.closeClaimsOfItem({ universityId }, event.aggregateId, note);
  }
}
