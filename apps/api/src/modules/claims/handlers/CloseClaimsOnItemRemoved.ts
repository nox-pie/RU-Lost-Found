import type { EventHandler, StoredEvent } from '../../../core/events/EventHandler';
import { payloadOf, type DomainEventType } from '../../events';
import type { ClaimService } from '../claim.service';

/**
 * Items and claims live in separate modules. When an item is removed, the items module doesn't
 * call the claims module; the claims module reacts to the ItemRemoved event instead.
 */
export class CloseClaimsOnItemRemoved implements EventHandler {
  readonly name = 'close-claims-on-item-removed';
  readonly handles = ['ItemRemoved'] as const satisfies readonly DomainEventType[];

  constructor(private readonly claims: ClaimService) {}

  async handle(event: StoredEvent): Promise<void> {
    const { universityId } = payloadOf(event, 'ItemRemoved');
    await this.claims.closeClaimsForRemovedItem({ universityId }, event.aggregateId);
  }
}
