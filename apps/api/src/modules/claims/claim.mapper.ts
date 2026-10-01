import type { ClaimDto, ClaimRole, ContactDto } from '@ru-lost-found/shared';
import type { Actor } from '../../core/domain/Actor';
import type { Item } from '../items/domain/Item';
import type { User } from '../users/domain/User';
import { toPersonSummary } from '../users/person.mapper';
import { type Claim, MAX_HANDOVER_ATTEMPTS } from './domain/Claim';

export interface ClaimView {
  claim: Claim;
  item: Item | undefined;
  claimant: User | undefined;
  reporter: User | undefined;
}

function roleOf(claim: Claim, viewer: Actor): ClaimRole {
  if (viewer.userId === claim.claimantId) return 'CLAIMANT';
  if (viewer.userId === claim.reporterId) return 'REPORTER';
  return 'STAFF';
}

/**
 * The other person's email (and phone, if they opted in), shown only to the two people involved
 * and only once the claim is approved. Before that, both see just a name and picture.
 */
function contactFor({ claim, claimant, reporter }: ClaimView, role: ClaimRole): ContactDto | null {
  if (claim.status !== 'APPROVED' && claim.status !== 'COMPLETED') return null;
  if (role === 'STAFF') return null;

  const other = role === 'CLAIMANT' ? reporter : claimant;
  const sharesPhone = role === 'CLAIMANT' ? claim.reporterSharesPhone : claim.claimantSharesPhone;
  if (!other) return null;
  return { email: other.email, phone: sharesPhone ? other.profile.phone : null };
}

export function toClaimDto(view: ClaimView, viewer: Actor): ClaimDto {
  const { claim, item } = view;
  const role = roleOf(claim, viewer);
  const questions = new Map(item?.verificationQuestions.map((q) => [q.id, q.question]) ?? []);
  const handover = claim.handover;
  const showHandover = handover && (claim.status === 'APPROVED' || claim.status === 'COMPLETED');

  return {
    id: claim.id,
    kind: claim.kind,
    status: claim.status,
    myRole: role,
    message: claim.message,
    answers: claim.answers.map((a) => ({
      questionId: a.questionId,
      question: questions.get(a.questionId) ?? '',
      answer: a.answer,
    })),
    item: {
      id: claim.itemId,
      type: item?.type ?? (claim.kind === 'OWNERSHIP' ? 'FOUND' : 'LOST'),
      title: item?.title ?? 'Removed item',
      status: item?.status ?? 'REMOVED',
      photo: item?.images[0]?.url ?? null,
    },
    claimant: toPersonSummary(claim.claimantId, view.claimant),
    reporter: toPersonSummary(claim.reporterId, view.reporter),
    contact: contactFor(view, role),
    handover: showHandover
      ? {
          deadline: handover.deadline.toISOString(),
          // Only the item's owner holds the code; they show it to the finder when they meet.
          code:
            claim.status === 'APPROVED' && viewer.userId === claim.ownerId ? handover.code : null,
          attemptsLeft: Math.max(0, MAX_HANDOVER_ATTEMPTS - handover.failedAttempts),
          locked: handover.failedAttempts >= MAX_HANDOVER_ATTEMPTS,
          viewerEntersCode: viewer.userId === claim.finderId,
        }
      : null,
    rejectionReason: claim.rejectionReason,
    history: claim.history.map((entry) => ({ status: entry.to, at: entry.at.toISOString() })),
    createdAt: claim.createdAt.toISOString(),
    updatedAt: claim.updatedAt.toISOString(),
  };
}
