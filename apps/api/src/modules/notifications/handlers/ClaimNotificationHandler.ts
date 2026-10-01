import { z } from 'zod';
import type { EventHandler, StoredEvent } from '../../../core/events/EventHandler';
import type { ClaimRepository } from '../../claims/domain/ClaimRepository';
import type { ItemRepository } from '../../items/domain/ItemRepository';
import type { User } from '../../users/domain/User';
import type { UserRepository } from '../../users/domain/UserRepository';
import type { NotificationEmails } from '../notification.emails';
import type { NotificationService } from '../notification.service';

/** Every claim event carries who is involved (see Claim.recordEvent). */
const claimEventPayload = z.object({
  universityId: z.string(),
  itemId: z.string(),
  reporterId: z.string(),
  claimantId: z.string(),
  ownerId: z.string(),
  deadline: z.string().optional(),
  automatic: z.boolean().optional(),
  cancelledBy: z.string().nullable().optional(),
  wasApproved: z.boolean().optional(),
});

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'Asia/Kolkata',
  });

/**
 * Tells the right people about each step of a claim, in the app and (for steps that need
 * action) by email. Loads names and titles when the event is handled, not when it's recorded.
 */
export class ClaimNotificationHandler implements EventHandler {
  readonly name = 'claim-notifications';
  readonly handles = [
    'ClaimRequested',
    'ClaimApproved',
    'ClaimRejected',
    'ClaimCancelled',
    'ClaimCompleted',
    'ClaimExpired',
  ] as const;

  constructor(
    private readonly notifications: NotificationService,
    private readonly claims: ClaimRepository,
    private readonly items: ItemRepository,
    private readonly users: UserRepository,
    private readonly emails: NotificationEmails,
  ) {}

  async handle(event: StoredEvent): Promise<void> {
    const p = claimEventPayload.parse(event.payload);
    const scope = { universityId: p.universityId };
    const [item, people] = await Promise.all([
      this.items.findById(scope, p.itemId),
      this.users.findByIds([p.reporterId, p.claimantId]),
    ]);
    const nameOf = (id: string) => people.find((u) => u.id === id)?.fullName ?? 'Someone';
    const title = item?.title ?? 'an item';
    const action = { label: 'Open the claim', path: `/claims/${event.aggregateId}` };
    const base = { claimId: event.aggregateId, itemId: p.itemId, sourceEventId: event.id };
    const email = (recipient: User, subject: string, paragraphs: string[], code?: string) =>
      this.emails.compose({
        to: recipient.email,
        firstName: recipient.profile.firstName,
        subject,
        heading: subject,
        paragraphs,
        code,
        action,
      });

    switch (event.type) {
      case 'ClaimRequested': {
        const isOwnershipClaim = p.ownerId === p.claimantId;
        const body = isOwnershipClaim
          ? `${nameOf(p.claimantId)} says “${title}” is theirs. Check their answers, then approve or decline.`
          : `${nameOf(p.claimantId)} says they found your “${title}”. Approve to arrange the handover.`;
        await this.notifications.notify({
          ...base,
          userId: p.reporterId,
          type: 'CLAIM_RECEIVED',
          title: `New claim on “${title}”`,
          body,
          email: (r) => email(r, `New claim on “${title}”`, [body]),
        });
        return;
      }

      case 'ClaimApproved': {
        const deadline = p.deadline ? formatDate(p.deadline) : 'the deadline';
        const claimantIsOwner = p.ownerId === p.claimantId;
        const claim = claimantIsOwner ? await this.claims.findById(scope, event.aggregateId) : null;
        const body = `${nameOf(p.reporterId)} approved your claim on “${title}”. Arrange to meet before ${deadline}.`;
        const codeLine = claimantIsOwner
          ? 'When you meet, show this code to the person handing it over:'
          : 'When you meet, ask the owner for their code and enter it in the app.';
        await this.notifications.notify({
          ...base,
          userId: p.claimantId,
          type: 'CLAIM_APPROVED',
          title: 'Your claim was approved',
          body,
          email: (r) =>
            email(r, 'Your claim was approved', [body, codeLine], claim?.handover?.code),
        });
        return;
      }

      case 'ClaimRejected': {
        const body = p.automatic
          ? `“${title}” was handed over to someone else, so your claim was closed.`
          : `${nameOf(p.reporterId)} declined your claim on “${title}”.`;
        await this.notifications.notify({
          ...base,
          userId: p.claimantId,
          type: 'CLAIM_REJECTED',
          title: 'Your claim was declined',
          body,
          email: p.automatic ? undefined : (r) => email(r, 'Your claim was declined', [body]),
        });
        return;
      }

      case 'ClaimCancelled': {
        const byClaimant = p.cancelledBy === p.claimantId;
        const recipient = byClaimant ? p.reporterId : p.claimantId;
        const body =
          p.cancelledBy === null || p.cancelledBy === undefined
            ? `“${title}” was removed, so your claim was closed.`
            : `${nameOf(p.cancelledBy)} cancelled the claim on “${title}”.`;
        await this.notifications.notify({
          ...base,
          userId: recipient,
          type: 'CLAIM_CANCELLED',
          title: 'A claim was cancelled',
          body,
          // Only worth an email if a handover had been arranged.
          email: p.wasApproved ? (r) => email(r, 'A claim was cancelled', [body]) : undefined,
        });
        return;
      }

      case 'ClaimCompleted': {
        for (const userId of [p.reporterId, p.claimantId]) {
          await this.notifications.notify({
            ...base,
            userId,
            type: 'HANDOVER_COMPLETED',
            title: 'Handover complete',
            body: `“${title}” is back with its owner. Thank you for helping it find its way home!`,
          });
        }
        return;
      }

      case 'ClaimExpired': {
        const body = `The handover of “${title}” didn't happen before the deadline, so the claim expired and the item is open again.`;
        for (const userId of [p.reporterId, p.claimantId]) {
          await this.notifications.notify({
            ...base,
            userId,
            type: 'CLAIM_EXPIRED',
            title: 'A claim expired',
            body,
            email: (r) => email(r, 'A claim expired', [body]),
          });
        }
        return;
      }
    }
  }
}
