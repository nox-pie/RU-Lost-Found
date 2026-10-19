import { describe, expect, it } from 'vitest';
import {
  ForbiddenError,
  InvalidStateTransitionError,
  ValidationError,
} from '../../../core/errors/AppError';
import {
  T0,
  aFoundItem,
  daysAfter,
  aLostItem,
  anActor,
  minutesAfter,
  reporterOf,
} from '../../../testing/builders';
import { MAX_ITEM_PHOTOS } from '@ru-lost-found/shared';
import { OPEN_FOR_DAYS, REMINDER_DAYS } from './Item';

const LATER = minutesAfter(T0, 5);
const photo = { url: 'https://img.example/a.jpg', publicId: 'items/a' };

describe('Item.report', () => {
  it('creates an open item with numbered verification questions', () => {
    const item = aFoundItem({ questions: [' Colour? ', '', 'Brand?'] });

    expect(item.status).toBe('OPEN');
    expect(item.verificationQuestions).toEqual([
      { id: 'q1', question: 'Colour?' },
      { id: 'q2', question: 'Brand?' },
    ]);
    expect(item.pullEvents()).toMatchObject([{ type: 'ItemReported' }]);
  });

  it.each([
    ['no photo', { images: [] }],
    ['too many photos', { images: Array(MAX_ITEM_PHOTOS + 1).fill(photo) }],
    ['too many questions', { questions: ['a', 'b', 'c', 'd'] }],
    ['a date more than a day in the future', { occurredOn: minutesAfter(T0, 25 * 60) }],
  ])('rejects %s', (_label, overrides) => {
    expect(() => aFoundItem(overrides)).toThrow(ValidationError);
  });

  it('rejects verification questions on lost items', () => {
    expect(() => aLostItem({ questions: ['Colour?'] })).toThrow(ValidationError);
  });
});

describe('Item.edit', () => {
  it('lets the reporter edit an open item and ignores undefined fields', () => {
    const item = aFoundItem();

    item.edit(reporterOf(item), { title: 'Black iPhone', location: undefined }, LATER);

    expect(item.title).toBe('Black iPhone');
    expect(item.location).toBe('Library');
    expect(item.updatedAt).toEqual(LATER);
  });

  it('does not let others edit', () => {
    const item = aFoundItem();

    expect(() => item.edit(anActor('UNIVERSITY_ADMIN'), { title: 'x' }, LATER)).toThrow(
      ForbiddenError,
    );
  });

  it('does not allow edits once a claim is approved', () => {
    const item = aFoundItem();
    item.reserve(LATER);

    expect(() => item.edit(reporterOf(item), { title: 'x' }, LATER)).toThrow(
      InvalidStateTransitionError,
    );
  });
});

describe('Item lifecycle', () => {
  it('goes OPEN → RESERVED → RESOLVED', () => {
    const item = aFoundItem();
    item.pullEvents();

    item.reserve(LATER);
    item.resolve(LATER);

    expect(item.status).toBe('RESOLVED');
    expect(item.resolvedAt).toEqual(LATER);
    expect(item.pullEvents().map((e) => e.type)).toEqual(['ItemResolved']);
  });

  it('can fall back from RESERVED to OPEN', () => {
    const item = aFoundItem();
    item.reserve(LATER);

    item.reopen(LATER);

    expect(item.status).toBe('OPEN');
    expect(item.isAcceptingClaims).toBe(true);
  });

  it.each([
    ['resolve an open item', (i: ReturnType<typeof aFoundItem>) => i.resolve(LATER)],
    ['reopen an open item', (i: ReturnType<typeof aFoundItem>) => i.reopen(LATER)],
    [
      'reserve a reserved item',
      (i: ReturnType<typeof aFoundItem>) => {
        i.reserve(LATER);
        i.reserve(LATER);
      },
    ],
  ])('cannot %s', (_label, act) => {
    expect(() => act(aFoundItem())).toThrow(InvalidStateTransitionError);
  });
});

describe('Item.remove', () => {
  it('lets the reporter remove it and reports the images to delete', () => {
    const item = aFoundItem();
    item.pullEvents();

    item.remove(reporterOf(item), LATER);

    expect(item.status).toBe('REMOVED');
    expect(item.pullEvents()).toMatchObject([
      {
        type: 'ItemRemoved',
        payload: { imagePublicIds: ['items/phone'], previousStatus: 'OPEN', byModerator: false },
      },
    ]);
  });

  it('lets a moderator remove it, recording the reason for the reporter', () => {
    const item = aFoundItem();
    item.pullEvents();

    item.remove(anActor('UNIVERSITY_ADMIN'), LATER, 'Selling, not lost');

    expect(item.status).toBe('REMOVED');
    expect(item.pullEvents()).toMatchObject([
      { type: 'ItemRemoved', payload: { byModerator: true, reason: 'Selling, not lost' } },
    ]);
  });

  it('does not let other students or security desk staff remove it', () => {
    const item = aFoundItem();

    expect(() => item.remove(anActor(), LATER)).toThrow(ForbiddenError);
    expect(() => item.remove(anActor('SECURITY_DESK'), LATER)).toThrow(ForbiddenError);
  });

  it('cannot be removed twice', () => {
    const item = aFoundItem();
    item.remove(reporterOf(item), LATER);

    expect(() => item.remove(reporterOf(item), LATER)).toThrow(InvalidStateTransitionError);
  });
});

describe('Item.close', () => {
  it('lets the reporter close an open post, with the reason', () => {
    const item = aLostItem();
    item.pullEvents();

    item.close(reporterOf(item), 'RETURNED', LATER);

    expect(item.status).toBe('CLOSED');
    expect(item.closeReason).toBe('RETURNED');
    expect(item.isAcceptingClaims).toBe(false);
    expect(item.pullEvents()).toMatchObject([
      { type: 'ItemClosed', payload: { reason: 'RETURNED', reporterId: item.reporterId } },
    ]);
  });

  it('is for the reporter only, and only while the post is open', () => {
    const item = aFoundItem();
    expect(() => item.close(anActor('UNIVERSITY_ADMIN'), 'WITHDRAWN', LATER)).toThrow(
      ForbiddenError,
    );

    item.reserve(LATER); // a handover is being arranged: cancel the claim first
    expect(() => item.close(reporterOf(item), 'WITHDRAWN', LATER)).toThrow(
      InvalidStateTransitionError,
    );
  });
});

describe('Item expiry', () => {
  const reminderDue = daysAfter(T0, OPEN_FOR_DAYS - REMINDER_DAYS);
  const expired = daysAfter(T0, OPEN_FOR_DAYS);

  it(`stays open ${OPEN_FOR_DAYS} days after it is posted`, () => {
    expect(aFoundItem().expiresAt).toEqual(daysAfter(T0, OPEN_FOR_DAYS));
  });

  it('reminds the reporter once, a week before it closes', () => {
    const item = aFoundItem();
    item.pullEvents();

    expect(item.remindOfExpiry(daysAfter(reminderDue, -1))).toBe(false); // too early
    expect(item.remindOfExpiry(reminderDue)).toBe(true);
    expect(item.remindOfExpiry(reminderDue)).toBe(false); // already reminded

    expect(item.pullEvents()).toMatchObject([
      { type: 'ItemExpiringSoon', payload: { expiresAt: expired.toISOString() } },
    ]);
  });

  it('closes only after the reminder had a week to be read', () => {
    const item = aFoundItem();

    expect(item.expire(expired)).toBe(false); // never reminded: no closing without warning
    item.remindOfExpiry(expired);
    expect(item.expire(daysAfter(expired, REMINDER_DAYS - 1))).toBe(false);
    expect(item.expire(daysAfter(expired, REMINDER_DAYS))).toBe(true);

    expect(item.status).toBe('CLOSED');
    expect(item.closeReason).toBe('EXPIRED');
  });

  it('can be kept open for another stretch, which clears the reminder', () => {
    const item = aFoundItem();
    item.remindOfExpiry(reminderDue);

    item.keepOpen(reporterOf(item), reminderDue);

    expect(item.expiresAt).toEqual(daysAfter(reminderDue, OPEN_FOR_DAYS));
    expect(item.remindOfExpiry(daysAfter(reminderDue, 1))).toBe(false);
  });

  it('can be reopened by the reporter after it closed', () => {
    const item = aFoundItem();
    item.close(reporterOf(item), 'WITHDRAWN', LATER);
    item.pullEvents();

    item.keepOpen(reporterOf(item), LATER);

    expect(item.status).toBe('OPEN');
    expect(item.closeReason).toBeNull();
    expect(item.expiresAt).toEqual(daysAfter(LATER, OPEN_FOR_DAYS));
    expect(item.pullEvents().map((e) => e.type)).toEqual(['ItemReopened']);
  });

  it('cannot be kept open by others, or once it was returned through a handover', () => {
    const item = aFoundItem();
    expect(() => item.keepOpen(anActor(), LATER)).toThrow(ForbiddenError);

    item.reserve(LATER);
    item.resolve(LATER);
    expect(() => item.keepOpen(reporterOf(item), LATER)).toThrow(InvalidStateTransitionError);
  });
});
