import { ROLE_RANK as RANK, type Role } from '@ru-lost-found/shared';
import { isModerator, type Actor } from '../../../core/domain/Actor';

/**
 * Who may manage whom. Admins act only on people ranked below them: never on themselves (so
 * nobody locks themselves out) and never on a fellow admin (so one admin can't remove another).
 * They may hand out roles up to their own rank, so a university can have several admins.
 */
export const RolePolicy = {
  canManage(actor: Actor, target: { id: string; role: Role }): boolean {
    return isModerator(actor) && actor.userId !== target.id && RANK[target.role] < RANK[actor.role];
  },

  canAssign(actor: Actor, role: Role): boolean {
    return isModerator(actor) && RANK[role] <= RANK[actor.role];
  },
};
