import type { Role, UserStatus } from '@ru-lost-found/shared';
import { AggregateRoot } from '../../../core/domain/AggregateRoot';
import type { ImageRef } from '../../../core/domain/ImageRef';
import type { Actor } from '../../../core/domain/Actor';
import { ForbiddenError, InvalidStateTransitionError } from '../../../core/errors/AppError';
import { RolePolicy } from './RolePolicy';

export interface UserProfile {
  firstName: string;
  lastName: string;
  /** Year of study, 1 = first year. */
  year: number;
  school: string;
  enrollmentNumber: string;
  phone: string | null;
  avatar: ImageRef | null;
}

export type EditableProfile = Omit<UserProfile, 'avatar'>;

export interface UserProps {
  id: string;
  universityId: string;
  email: string;
  passwordHash: string;
  profile: UserProfile;
  role: Role;
  status: UserStatus;
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

/**
 * Demo accounts (sample data for visitors) use addresses on this domain. It is reserved
 * (RFC 2606), so no email can ever reach it, and it marks the account as a demo account.
 */
export const DEMO_EMAIL_DOMAIN = 'demo.invalid';

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export class User extends AggregateRoot {
  private constructor(private props: UserProps) {
    super(props.id, props.version);
  }

  static register(input: {
    id: string;
    universityId: string;
    email: string;
    passwordHash: string;
    profile: EditableProfile;
    now: Date;
  }): User {
    const user = new User({
      id: input.id,
      universityId: input.universityId,
      email: normalizeEmail(input.email),
      passwordHash: input.passwordHash,
      profile: { ...input.profile, avatar: null },
      role: 'STUDENT',
      status: 'ACTIVE',
      createdAt: input.now,
      updatedAt: input.now,
      version: 0,
    });
    user.record({
      type: 'UserRegistered',
      aggregateId: user.id,
      occurredAt: input.now,
      payload: { universityId: user.universityId },
    });
    return user;
  }

  static restore(props: UserProps): User {
    return new User(props);
  }

  get universityId() {
    return this.props.universityId;
  }
  get email() {
    return this.props.email;
  }
  get passwordHash() {
    return this.props.passwordHash;
  }
  get profile(): Readonly<UserProfile> {
    return this.props.profile;
  }
  get fullName() {
    return `${this.props.profile.firstName} ${this.props.profile.lastName}`;
  }
  get role() {
    return this.props.role;
  }
  get status() {
    return this.props.status;
  }
  get isActive() {
    return this.props.status === 'ACTIVE';
  }
  /** A demo account of the sample data (see modules/demo). */
  get isDemo() {
    return this.props.email.endsWith(`@${DEMO_EMAIL_DOMAIN}`);
  }
  get createdAt() {
    return this.props.createdAt;
  }
  get updatedAt() {
    return this.props.updatedAt;
  }

  /** Demo accounts are shared by every visitor, so nobody may change who they are. */
  assertEditable(): void {
    if (this.isDemo) {
      throw new ForbiddenError(
        'Demo accounts can’t be changed. Create your own account to set up a profile.',
      );
    }
  }

  updateProfile(changes: Partial<EditableProfile>, now: Date): void {
    this.assertEditable();
    const defined = Object.fromEntries(
      Object.entries(changes).filter(([, value]) => value !== undefined),
    ) as Partial<EditableProfile>;
    this.props.profile = { ...this.props.profile, ...defined };
    this.touch(now);
  }

  /** Returns the previous avatar so the caller can delete the old file. */
  changeAvatar(avatar: ImageRef, now: Date): ImageRef | null {
    this.assertEditable();
    const previous = this.props.profile.avatar;
    this.props.profile = { ...this.props.profile, avatar };
    this.touch(now);
    return previous;
  }

  /** Returns the removed avatar so the caller can delete the file. */
  removeAvatar(now: Date): ImageRef | null {
    this.assertEditable();
    const previous = this.props.profile.avatar;
    if (previous) {
      this.props.profile = { ...this.props.profile, avatar: null };
      this.touch(now);
    }
    return previous;
  }

  changePassword(passwordHash: string, now: Date): void {
    this.assertEditable();
    this.props.passwordHash = passwordHash;
    this.touch(now);
    this.record({ type: 'PasswordChanged', aggregateId: this.id, occurredAt: now, payload: {} });
  }

  /** An admin gives this user another role. Recording the same role again changes nothing. */
  changeRole(role: Role, by: Actor, now: Date): void {
    this.assertManageableBy(by);
    if (!RolePolicy.canAssign(by, role)) {
      throw new ForbiddenError('You can’t give that role.');
    }
    if (role === this.props.role) return;
    this.applyRole(role, by.userId, now);
  }

  /**
   * Bootstrap only: the first admin is appointed from the command line (scripts/set-role.ts),
   * where there is no admin yet to do it. The change is still recorded and audited.
   */
  appointBySystem(role: Role, now: Date): void {
    if (role !== this.props.role) this.applyRole(role, null, now);
  }

  /** Blocks sign-in. The caller also ends the user's sessions. */
  suspend(reason: string, by: Actor, now: Date): void {
    this.assertManageableBy(by);
    if (this.props.status === 'SUSPENDED') {
      throw new InvalidStateTransitionError('This user is already suspended.');
    }
    this.props.status = 'SUSPENDED';
    this.touch(now);
    this.record({
      type: 'UserSuspended',
      aggregateId: this.id,
      occurredAt: now,
      payload: { universityId: this.universityId, actorId: by.userId, reason },
    });
  }

  reactivate(by: Actor, now: Date): void {
    this.assertManageableBy(by);
    if (this.props.status === 'ACTIVE') {
      throw new InvalidStateTransitionError('This user is already active.');
    }
    this.props.status = 'ACTIVE';
    this.touch(now);
    this.record({
      type: 'UserReactivated',
      aggregateId: this.id,
      occurredAt: now,
      payload: { universityId: this.universityId, actorId: by.userId },
    });
  }

  private assertManageableBy(actor: Actor): void {
    if (!RolePolicy.canManage(actor, { id: this.id, role: this.props.role })) {
      throw new ForbiddenError(
        actor.userId === this.id
          ? 'You can’t change your own account here.'
          : 'You can only manage people with a lower role than yours.',
      );
    }
  }

  private applyRole(role: Role, actorId: string | null, now: Date): void {
    const previous = this.props.role;
    this.props.role = role;
    this.touch(now);
    this.record({
      type: 'UserRoleChanged',
      aggregateId: this.id,
      occurredAt: now,
      payload: { universityId: this.universityId, actorId, from: previous, to: role },
    });
  }

  private touch(now: Date): void {
    this.props.updatedAt = now;
  }
}
