import type { ClaimStatus } from '@ru-lost-found/shared';
import { describe, expect, it } from 'vitest';
import {
  ForbiddenError,
  InvalidStateTransitionError,
  ValidationError,
} from '../../../core/errors/AppError';
import {
  T0,
  aClaimOn,
  aFoundItem,
  aLostItem,
  anActor,
  daysAfter,
  minutesAfter,
  reporterOf,
} from '../../../testing/builders';
import { Claim, MAX_HANDOVER_ATTEMPTS } from './Claim';

const CODE = '483920';
const DEADLINE = daysAfter(T0, 7);
const LATER = minutesAfter(T0, 30);

function approvedClaim() {
  const item = aFoundItem();
  const claimant = anActor();
  const claim = aClaimOn(item, claimant);
  claim.approve(reporterOf(item), { code: CODE, deadline: DEADLINE }, LATER);
  claim.pullEvents();
  return { item, claimant, claim, reporter: reporterOf(item) };
}

describe('Claim.submit', () => {
  it('creates an OWNERSHIP claim on a found item with answers in question order', () => {
    const item = aFoundItem({ questions: ['Colour of the case?', 'Wallpaper?'] });
    const claimant = anActor();

    const claim = Claim.submit({
      id: 'c1',
      item,
      claimant,
      message: '  It is mine  ',
      answers: [
        { questionId: 'q2', answer: 'Mountains' },
        { questionId: 'q1', answer: ' Red ' },
      ],
      now: T0,
    });

    expect(claim.status).toBe('REQUESTED');
    expect(claim.kind).toBe('OWNERSHIP');
    expect(claim.message).toBe('It is mine');
    expect(claim.answers).toEqual([
      { questionId: 'q1', answer: 'Red' },
      { questionId: 'q2', answer: 'Mountains' },
    ]);
    expect(claim.ownerId).toBe(claimant.userId);
    expect(claim.finderId).toBe(item.reporterId);
    expect(claim.history).toEqual([
      { from: null, to: 'REQUESTED', byUserId: claimant.userId, at: T0, note: null },
    ]);
    expect(claim.pullEvents().map((e) => e.type)).toEqual(['ClaimRequested']);
  });

  it('creates a FINDER claim on a lost item, where the reporter is the owner', () => {
    const item = aLostItem();
    const claimant = anActor();

    const claim = aClaimOn(item, claimant, { answers: [] });

    expect(claim.kind).toBe('FINDER');
    expect(claim.ownerId).toBe(item.reporterId);
    expect(claim.finderId).toBe(claimant.userId);
  });

  it('rejects a claim on your own item', () => {
    const item = aFoundItem();

    expect(() => aClaimOn(item, reporterOf(item))).toThrow(ForbiddenError);
  });

  it('rejects a claim on an item that is not open', () => {
    const item = aFoundItem();
    item.reserve(T0);

    expect(() => aClaimOn(item)).toThrow(InvalidStateTransitionError);
  });

  it.each([
    ['a missing answer', []],
    ['an unknown question', [{ questionId: 'q9', answer: 'x' }]],
    ['a blank answer', [{ questionId: 'q1', answer: '   ' }]],
    [
      'a duplicate answer',
      [
        { questionId: 'q1', answer: 'a' },
        { questionId: 'q1', answer: 'b' },
      ],
    ],
  ])('rejects %s', (_label, answers) => {
    expect(() => aClaimOn(aFoundItem(), anActor(), { answers })).toThrow(ValidationError);
  });

  it('rejects answers on an item without questions', () => {
    const item = aLostItem();

    expect(() =>
      aClaimOn(item, anActor(), { answers: [{ questionId: 'q1', answer: 'x' }] }),
    ).toThrow(ValidationError);
  });
});

describe('Claim.approve', () => {
  it('lets the reporter approve and starts a handover', () => {
    const item = aFoundItem();
    const claim = aClaimOn(item);
    claim.pullEvents();

    claim.approve(reporterOf(item), { code: CODE, deadline: DEADLINE }, LATER);

    expect(claim.status).toBe('APPROVED');
    expect(claim.handover).toEqual({ code: CODE, deadline: DEADLINE, failedAttempts: 0 });
    expect(claim.history.at(-1)).toMatchObject({ from: 'REQUESTED', to: 'APPROVED' });
    expect(claim.pullEvents()).toMatchObject([
      { type: 'ClaimApproved', payload: { deadline: DEADLINE.toISOString() } },
    ]);
  });

  it('does not let anyone else approve', () => {
    const claim = aClaimOn(aFoundItem());

    expect(() =>
      claim.approve(anActor('UNIVERSITY_ADMIN'), { code: CODE, deadline: DEADLINE }, LATER),
    ).toThrow(ForbiddenError);
    expect(claim.status).toBe('REQUESTED');
  });
});

describe('Claim.reject', () => {
  it('records the reason', () => {
    const item = aFoundItem();
    const claim = aClaimOn(item);

    claim.reject(reporterOf(item), '  Wrong wallpaper  ', LATER);

    expect(claim.status).toBe('REJECTED');
    expect(claim.rejectionReason).toBe('Wrong wallpaper');
    expect(claim.history.at(-1)).toMatchObject({ to: 'REJECTED', note: 'Wrong wallpaper' });
  });

  it('can be done by the system without a user', () => {
    const claim = aClaimOn(aFoundItem());

    claim.rejectAutomatically('Another claim was completed.', LATER);

    expect(claim.history.at(-1)).toMatchObject({ to: 'REJECTED', byUserId: null });
  });
});

describe('Claim.cancel', () => {
  it('lets the claimant withdraw a request', () => {
    const item = aFoundItem();
    const claimant = anActor();
    const claim = aClaimOn(item, claimant);
    claim.pullEvents();

    claim.cancel(claimant, LATER);

    expect(claim.status).toBe('CANCELLED');
    expect(claim.pullEvents()).toMatchObject([
      { type: 'ClaimCancelled', payload: { wasApproved: false } },
    ]);
  });

  it('lets either party cancel an approved claim and reports that it was approved', () => {
    const { claim, reporter } = approvedClaim();

    claim.cancel(reporter, LATER);

    expect(claim.status).toBe('CANCELLED');
    expect(claim.pullEvents()).toMatchObject([
      { type: 'ClaimCancelled', payload: { wasApproved: true } },
    ]);
  });

  it('does not let outsiders cancel', () => {
    const claim = aClaimOn(aFoundItem());

    expect(() => claim.cancel(anActor(), LATER)).toThrow(ForbiddenError);
  });
});

describe('phone sharing', () => {
  it('records each side’s choice separately', () => {
    const item = aFoundItem();
    const claim = aClaimOn(item, anActor(), { sharePhone: true });

    claim.approve(reporterOf(item), { code: CODE, deadline: DEADLINE, sharePhone: false }, LATER);

    expect(claim.claimantSharesPhone).toBe(true);
    expect(claim.reporterSharesPhone).toBe(false);
  });
});

describe('Claim.cancelAutomatically', () => {
  it('ends requested and approved claims without a user, with the reason', () => {
    const requested = aClaimOn(aFoundItem());
    const { claim: approvedOne } = approvedClaim();

    requested.cancelAutomatically('The item was removed.', LATER);
    approvedOne.cancelAutomatically('The item was removed.', LATER);

    for (const claim of [requested, approvedOne]) {
      expect(claim.status).toBe('CANCELLED');
      expect(claim.history.at(-1)).toMatchObject({ byUserId: null, note: 'The item was removed.' });
    }
  });
});

describe('Claim.completeHandover', () => {
  it('completes when the finder enters the right code', () => {
    const { claim, reporter } = approvedClaim();

    const result = claim.completeHandover(reporter, ` ${CODE} `, LATER);

    expect(result).toBe('COMPLETED');
    expect(claim.status).toBe('COMPLETED');
    expect(claim.pullEvents()).toMatchObject([
      { type: 'ClaimCompleted', payload: { confirmedBy: 'CODE' } },
    ]);
  });

  it('only accepts the code from the finder', () => {
    const { claim, claimant } = approvedClaim();

    expect(() => claim.completeHandover(claimant, CODE, LATER)).toThrow(ForbiddenError);
  });

  it('counts wrong codes and locks after the maximum number of attempts', () => {
    const { claim, reporter } = approvedClaim();

    const results = Array.from({ length: MAX_HANDOVER_ATTEMPTS + 1 }, () =>
      claim.completeHandover(reporter, '000000', LATER),
    );

    expect(results.slice(0, MAX_HANDOVER_ATTEMPTS - 1)).toEqual(
      Array(MAX_HANDOVER_ATTEMPTS - 1).fill('WRONG_CODE'),
    );
    expect(results.slice(MAX_HANDOVER_ATTEMPTS - 1)).toEqual(['LOCKED', 'LOCKED']);
    expect(claim.handover?.failedAttempts).toBe(MAX_HANDOVER_ATTEMPTS);
    expect(claim.completeHandover(reporter, CODE, LATER)).toBe('LOCKED');
    expect(claim.status).toBe('APPROVED');
  });

  it('refuses codes after the deadline', () => {
    const { claim, reporter } = approvedClaim();

    expect(() => claim.completeHandover(reporter, CODE, daysAfter(DEADLINE, 1))).toThrow(
      InvalidStateTransitionError,
    );
  });

  it('can be confirmed by security desk staff, e.g. when the code is locked', () => {
    const { claim } = approvedClaim();

    claim.completeHandoverAsStaff(anActor('SECURITY_DESK'), LATER);

    expect(claim.status).toBe('COMPLETED');
    expect(claim.history.at(-1)?.note).toBe('Confirmed by staff');
  });

  it('does not let staff confirm a claim they are part of', () => {
    const item = aFoundItem();
    const staffClaimant = anActor('SECURITY_DESK');
    const claim = aClaimOn(item, staffClaimant);
    claim.approve(reporterOf(item), { code: CODE, deadline: DEADLINE }, LATER);

    expect(() => claim.completeHandoverAsStaff(staffClaimant, LATER)).toThrow(ForbiddenError);
  });

  it('does not let students use the staff confirmation', () => {
    const { claim, reporter } = approvedClaim();

    expect(() => claim.completeHandoverAsStaff(reporter, LATER)).toThrow(ForbiddenError);
  });
});

describe('Claim.expire', () => {
  it('expires an approved claim after its deadline', () => {
    const { claim } = approvedClaim();

    claim.expire(daysAfter(DEADLINE, 1));

    expect(claim.status).toBe('EXPIRED');
    expect(claim.history.at(-1)).toMatchObject({ to: 'EXPIRED', byUserId: null });
  });

  it('does not expire before the deadline', () => {
    const { claim } = approvedClaim();

    expect(() => claim.expire(LATER)).toThrow(InvalidStateTransitionError);
  });
});

describe('Claim state machine', () => {
  type Action = 'approve' | 'reject' | 'cancel' | 'completeHandover' | 'expire';

  /** Which actions each status allows. Everything else must throw InvalidStateTransitionError. */
  const allowed: Record<ClaimStatus, Action[]> = {
    REQUESTED: ['approve', 'reject', 'cancel'],
    APPROVED: ['cancel', 'completeHandover', 'expire'],
    REJECTED: [],
    CANCELLED: [],
    EXPIRED: [],
    COMPLETED: [],
  };

  function claimIn(status: ClaimStatus) {
    const { claim, reporter, claimant } = approvedClaim();
    if (status === 'REQUESTED') {
      const item = aFoundItem();
      return { claim: aClaimOn(item), reporter: reporterOf(item), claimant };
    }
    if (status === 'REJECTED') {
      const item = aFoundItem();
      const requested = aClaimOn(item);
      requested.reject(reporterOf(item), null, LATER);
      return { claim: requested, reporter: reporterOf(item), claimant };
    }
    if (status === 'CANCELLED') claim.cancel(reporter, LATER);
    if (status === 'EXPIRED') claim.expire(daysAfter(DEADLINE, 1));
    if (status === 'COMPLETED') claim.completeHandover(reporter, CODE, LATER);
    return { claim, reporter, claimant };
  }

  function perform(action: Action, status: ClaimStatus) {
    const { claim, reporter } = claimIn(status);
    const afterDeadline = daysAfter(DEADLINE, 1);
    switch (action) {
      case 'approve':
        return claim.approve(reporter, { code: CODE, deadline: DEADLINE }, LATER);
      case 'reject':
        return claim.reject(reporter, null, LATER);
      case 'cancel':
        return claim.cancel(reporter, LATER);
      case 'completeHandover':
        return claim.completeHandoverAsStaff(anActor('SECURITY_DESK'), LATER);
      case 'expire':
        return claim.expire(afterDeadline);
    }
  }

  const actions: Action[] = ['approve', 'reject', 'cancel', 'completeHandover', 'expire'];
  const cases = (Object.keys(allowed) as ClaimStatus[]).flatMap((status) =>
    actions.map((action) => ({ status, action, legal: allowed[status].includes(action) })),
  );

  it.each(cases)('$status → $action is legal: $legal', ({ status, action, legal }) => {
    if (legal) {
      expect(() => perform(action, status)).not.toThrow();
    } else {
      expect(() => perform(action, status)).toThrow(InvalidStateTransitionError);
    }
  });

  it('marks only REQUESTED and APPROVED as active', () => {
    const active = (Object.keys(allowed) as ClaimStatus[]).filter(
      (status) => claimIn(status).claim.isActive,
    );

    expect(active).toEqual(['REQUESTED', 'APPROVED']);
  });
});
