import type { Role } from '@ru-lost-found/shared';

/** The authenticated user performing an action, as seen by domain rules. */
export interface Actor {
  readonly userId: string;
  readonly role: Role;
}

const STAFF_ROLES: readonly Role[] = ['SECURITY_DESK', 'UNIVERSITY_ADMIN', 'PLATFORM_ADMIN'];
const MODERATOR_ROLES: readonly Role[] = ['UNIVERSITY_ADMIN', 'PLATFORM_ADMIN'];

/** Security desk and admins: may confirm handovers on behalf of students. */
export function isStaff(actor: Actor): boolean {
  return STAFF_ROLES.includes(actor.role);
}

/** Admins: may remove other people's posts. */
export function isModerator(actor: Actor): boolean {
  return MODERATOR_ROLES.includes(actor.role);
}
