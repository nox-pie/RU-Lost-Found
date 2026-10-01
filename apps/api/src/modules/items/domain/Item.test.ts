import { describe, expect, it } from 'vitest';
import {
  ForbiddenError,
  InvalidStateTransitionError,
  ValidationError,
} from '../../../core/errors/AppError';
import {
  T0,
  aFoundItem,
  aLostItem,
  anActor,
  minutesAfter,
  reporterOf,
} from '../../../testing/builders';
import { MAX_ITEM_PHOTOS } from '@ru-lost-found/shared';

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
