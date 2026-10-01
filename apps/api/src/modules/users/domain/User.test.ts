import { describe, expect, it } from 'vitest';
import type { Actor } from '../../../core/domain/Actor';
import { ForbiddenError, InvalidStateTransitionError } from '../../../core/errors/AppError';
import { T0, aUser, minutesAfter } from '../../../testing/builders';

const LATER = minutesAfter(T0, 5);

describe('User', () => {
  it('registers as an active student with a normalised email', () => {
    const user = aUser({ email: '  Asha.V@NST.Rishihood.edu.in ' });

    expect(user.email).toBe('asha.v@nst.rishihood.edu.in');
    expect(user.role).toBe('STUDENT');
    expect(user.isActive).toBe(true);
    expect(user.profile.avatar).toBeNull();
    expect(user.pullEvents().map((e) => e.type)).toEqual(['UserRegistered']);
  });

  it('updates only the profile fields that are provided', () => {
    const user = aUser();

    user.updateProfile({ phone: '+91 98765 43210', firstName: undefined }, LATER);

    expect(user.profile.phone).toBe('+91 98765 43210');
    expect(user.profile.firstName).toBe('Asha');
    expect(user.updatedAt).toEqual(LATER);
  });

  it('returns the previous avatar when it changes, so the old file can be deleted', () => {
    const user = aUser();
    const first = { url: 'https://img.example/1.jpg', publicId: 'avatars/1' };
    const second = { url: 'https://img.example/2.jpg', publicId: 'avatars/2' };

    expect(user.changeAvatar(first, LATER)).toBeNull();
    expect(user.changeAvatar(second, LATER)).toEqual(first);
    expect(user.profile.avatar).toEqual(second);
  });

  it('can be suspended and reactivated by an admin, but not twice in a row', () => {
    const user = aUser();
    user.pullEvents();

    user.suspend('Posting spam', admin, LATER);
    expect(user.isActive).toBe(false);
    expect(() => user.suspend('Again', admin, LATER)).toThrow(InvalidStateTransitionError);

    user.reactivate(admin, LATER);
    expect(user.isActive).toBe(true);
    expect(() => user.reactivate(admin, LATER)).toThrow(InvalidStateTransitionError);

    expect(user.pullEvents()).toMatchObject([
      { type: 'UserSuspended', payload: { actorId: admin.userId, reason: 'Posting spam' } },
      { type: 'UserReactivated', payload: { actorId: admin.userId } },
    ]);
  });
});

const admin: Actor = { userId: 'a'.repeat(24), role: 'UNIVERSITY_ADMIN' };
const platformAdmin: Actor = { userId: 'b'.repeat(24), role: 'PLATFORM_ADMIN' };

describe('User roles', () => {
  it('lets an admin promote a student up to their own rank, recording who did it', () => {
    const user = aUser();
    user.pullEvents();

    user.changeRole('SECURITY_DESK', admin, LATER);
    user.changeRole('SECURITY_DESK', admin, LATER);

    expect(user.role).toBe('SECURITY_DESK');
    expect(user.pullEvents()).toMatchObject([
      {
        type: 'UserRoleChanged',
        payload: { actorId: admin.userId, from: 'STUDENT', to: 'SECURITY_DESK' },
      },
    ]);
  });

  it('never lets an admin give a role above their own', () => {
    expect(() => aUser().changeRole('PLATFORM_ADMIN', admin, LATER)).toThrow(ForbiddenError);
    expect(() => aUser().changeRole('PLATFORM_ADMIN', platformAdmin, LATER)).not.toThrow();
  });

  it('protects admins from each other and from locking themselves out', () => {
    const peer = aUser();
    peer.appointBySystem('UNIVERSITY_ADMIN', LATER);
    const self = aUser({ id: admin.userId });
    self.appointBySystem('UNIVERSITY_ADMIN', LATER);

    expect(() => peer.suspend('No', admin, LATER)).toThrow(/lower role/);
    expect(() => peer.changeRole('STUDENT', admin, LATER)).toThrow(ForbiddenError);
    expect(() => self.changeRole('STUDENT', admin, LATER)).toThrow(/your own account/);
    expect(() => peer.changeRole('STUDENT', platformAdmin, LATER)).not.toThrow();
  });

  it('refuses everyone who is not an admin', () => {
    const desk: Actor = { userId: 'c'.repeat(24), role: 'SECURITY_DESK' };

    expect(() => aUser().changeRole('STUDENT', desk, LATER)).toThrow(ForbiddenError);
    expect(() => aUser().suspend('Spam', desk, LATER)).toThrow(ForbiddenError);
  });

  it('records a role appointed from the command line with no actor', () => {
    const user = aUser();
    user.pullEvents();

    user.appointBySystem('UNIVERSITY_ADMIN', LATER);

    expect(user.pullEvents()).toMatchObject([
      { type: 'UserRoleChanged', payload: { actorId: null, to: 'UNIVERSITY_ADMIN' } },
    ]);
  });
});
