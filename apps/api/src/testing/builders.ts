import type { Role } from '@ru-lost-found/shared';
import type { Actor } from '../core/domain/Actor';
import type { Clock } from '../core/domain/Clock';
import { ObjectIdGenerator } from '../infrastructure/database/objectIds';
import { Claim, type ClaimAnswer } from '../modules/claims/domain/Claim';
import { Item } from '../modules/items/domain/Item';
import { University } from '../modules/universities/domain/University';
import { User } from '../modules/users/domain/User';

/** Builders for valid domain objects, so each test only spells out what it cares about. */

export const ids = new ObjectIdGenerator();

export const T0 = new Date('2026-10-01T10:00:00.000Z');

export function minutesAfter(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

export function daysAfter(date: Date, days: number): Date {
  return minutesAfter(date, days * 24 * 60);
}

/** A clock that only moves when the test moves it. */
export class FixedClock implements Clock {
  constructor(private current: Date = T0) {}

  now(): Date {
    return new Date(this.current);
  }

  set(date: Date): void {
    this.current = date;
  }
}

export function anActor(role: Role = 'STUDENT'): Actor {
  return { userId: ids.next(), role };
}

export function aUniversity(overrides: Partial<Parameters<typeof University.create>[0]> = {}) {
  return University.create({
    id: ids.next(),
    name: 'Rishihood University',
    slug: `rishihood-${ids.next().slice(-6)}`,
    emailDomains: ['rishihood.edu.in'],
    schools: ['Newton School of Technology', 'School of Entrepreneurship'],
    now: T0,
    ...overrides,
  });
}

export function aUser(overrides: Partial<Parameters<typeof User.register>[0]> = {}) {
  return User.register({
    id: ids.next(),
    universityId: ids.next(),
    email: `student.${ids.next().slice(-6)}@nst.rishihood.edu.in`,
    passwordHash: '$2b$10$hash',
    profile: {
      firstName: 'Asha',
      lastName: 'Verma',
      year: 2,
      school: 'Newton School of Technology',
      enrollmentNumber: 'NST23001',
      phone: null,
    },
    now: T0,
    ...overrides,
  });
}

type ReportInput = Parameters<typeof Item.report>[0];

export function aFoundItem(overrides: Partial<ReportInput> = {}): Item {
  return Item.report({
    id: ids.next(),
    universityId: ids.next(),
    reporterId: ids.next(),
    type: 'FOUND',
    category: 'ELECTRONICS',
    title: 'Black phone',
    description: 'Found near the library entrance.',
    location: 'Library',
    occurredOn: T0,
    images: [{ url: 'https://img.example/phone.jpg', publicId: 'items/phone' }],
    questions: ['What is the lock-screen wallpaper?'],
    now: T0,
    ...overrides,
  });
}

export function aLostItem(overrides: Partial<ReportInput> = {}): Item {
  return aFoundItem({ type: 'LOST', title: 'Blue bottle', questions: [], ...overrides });
}

/** Answers every verification question of the item. */
export function answersFor(item: Item): ClaimAnswer[] {
  return item.verificationQuestions.map((q) => ({ questionId: q.id, answer: 'A mountain photo' }));
}

export function aClaimOn(
  item: Item,
  claimant: Actor = anActor(),
  overrides: Partial<Parameters<typeof Claim.submit>[0]> = {},
): Claim {
  return Claim.submit({
    id: ids.next(),
    item,
    claimant,
    message: 'I think this is mine.',
    answers: answersFor(item),
    now: T0,
    ...overrides,
  });
}

/** The reporter of an item, as an actor. */
export function reporterOf(item: Item): Actor {
  return { userId: item.reporterId, role: 'STUDENT' };
}
