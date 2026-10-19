import { describe, expect, it } from 'vitest';
import { STRONG_MATCH, SHOW_MATCH, scoreMatch, type MatchablePost } from './matchScore';

const day = (n: number) => new Date(Date.UTC(2026, 9, n));

const lostPhone: MatchablePost = {
  category: 'ELECTRONICS',
  title: 'Black iPhone 13',
  description: 'Lost my black iPhone with a cracked screen protector and a blue case.',
  location: 'Second floor',
  place: 'Library',
  occurredOn: day(10),
};
const found = (overrides: Partial<MatchablePost> = {}): MatchablePost => ({
  category: 'ELECTRONICS',
  title: 'Black phone',
  description: 'Found a black iPhone in a blue case, the screen protector is cracked.',
  location: 'Reading room',
  place: 'Library',
  occurredOn: day(10),
  ...overrides,
});

describe('scoreMatch', () => {
  it('rates the same thing, same day, same place as a strong match', () => {
    expect(scoreMatch(lostPhone, found())).toBeGreaterThanOrEqual(STRONG_MATCH);
  });

  it('still suggests it when the place is unknown or the words differ', () => {
    const elsewhere = scoreMatch(lostPhone, found({ place: null }));
    const fewWords = scoreMatch(
      lostPhone,
      found({ title: 'Mobile', description: 'Handed in a mobile found on a table.' }),
    );

    expect(elsewhere).toBeGreaterThanOrEqual(SHOW_MATCH);
    expect(fewWords).toBeGreaterThanOrEqual(SHOW_MATCH);
    expect(fewWords!).toBeLessThan(scoreMatch(lostPhone, found())!);
  });

  it('scores lower the further apart the dates and places are', () => {
    const sameDay = scoreMatch(lostPhone, found())!;
    const weekLater = scoreMatch(lostPhone, found({ occurredOn: day(17) }))!;
    const otherPlace = scoreMatch(lostPhone, found({ place: 'Canteen' }))!;

    expect(weekLater).toBeLessThan(sameDay);
    expect(otherPlace).toBeLessThan(sameDay);
  });

  it('never pairs different categories, or a find long before or after the loss', () => {
    expect(scoreMatch(lostPhone, found({ category: 'WALLET' }))).toBeNull();
    expect(scoreMatch(lostPhone, found({ occurredOn: day(5) }))).toBeNull(); // found before lost
    expect(
      scoreMatch(lostPhone, found({ occurredOn: new Date(Date.UTC(2026, 10, 20)) })),
    ).toBeNull();
  });

  it('allows two days of slack for a date picked carelessly', () => {
    expect(scoreMatch(lostPhone, found({ occurredOn: day(8) }))).not.toBeNull();
  });

  it('ignores filler words and plural endings when comparing the descriptions', () => {
    const keys = scoreMatch(
      {
        ...lostPhone,
        category: 'KEYS',
        title: 'Bunch of keys',
        description: 'Three keys on a red ring.',
      },
      found({ category: 'KEYS', title: 'Key ring', description: 'A red ring with three key.' }),
    );
    expect(keys).toBeGreaterThanOrEqual(STRONG_MATCH);
  });
});
