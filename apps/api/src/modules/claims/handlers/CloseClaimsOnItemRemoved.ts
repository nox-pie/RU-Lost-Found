import { z } from 'zod';
import type { EventHandler, StoredEvent } from '../../../core/events/EventHandler';
import type { ClaimService } from '../claim.service';

const payload = z.object({ universityId: z.string() });

/**
 * Items and claims live in separate modules. When an item is removed, the items module doesn't
 * call the claims module; the claims module reacts to the ItemRemoved event instead.
 */
export class CloseClaimsOnItemRemoved implements EventHandler {
  readonly name = 'close-claims-on-item-removed';
  readonly handles = ['ItemRemoved'] as const;

  constructor(private readonly claims: ClaimService) {}

  async handle(event: StoredEvent): Promise<void> {
    const { universityId } = payload.parse(event.payload);
    await this.claims.closeClaimsForRemovedItem({ universityId }, event.aggregateId);
  }
}
