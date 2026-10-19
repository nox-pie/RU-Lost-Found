import {
  ITEM_STATUSES,
  type AccountExportDto,
  type DeleteAccountInput,
} from '@ru-lost-found/shared';
import type { Actor } from '../../core/domain/Actor';
import type { Clock } from '../../core/domain/Clock';
import type { EmailSender } from '../../core/email/EmailSender';
import { UnauthorizedError, ValidationError } from '../../core/errors/AppError';
import type { Logger } from '../../core/logger/logger';
import type { PageResult } from '../../core/persistence/Pagination';
import type { PasswordHasher } from '../../core/security/PasswordHasher';
import type { StorageProvider } from '../../core/storage/StorageProvider';
import type { LoginThrottle } from '../auth/LoginThrottle';
import type { SessionRepository } from '../auth/domain/SessionRepository';
import { toClaimDto } from '../claims/claim.mapper';
import type { ClaimService } from '../claims/claim.service';
import type { ClaimRepository } from '../claims/domain/ClaimRepository';
import type { ItemRepository } from '../items/domain/ItemRepository';
import { toItemDto } from '../items/item.mapper';
import type { ItemService } from '../items/item.service';
import type { NotificationRepository } from '../notifications/domain/NotificationRepository';
import type { NotificationEmails } from '../notifications/notification.emails';
import { toNotificationDto } from '../notifications/notification.mapper';
import type { User } from '../users/domain/User';
import type { UserRepository } from '../users/domain/UserRepository';
import { toMeDto } from '../users/user.mapper';

const PAGE_SIZE = 50;
/** Safety stop for the loops below: 200 pages of 50 is far more than one person ever makes. */
const MAX_PAGES = 200;

export interface AccountServiceDeps {
  users: UserRepository;
  items: ItemRepository;
  claims: ClaimRepository;
  notifications: NotificationRepository;
  sessions: SessionRepository;
  itemService: ItemService;
  claimService: ClaimService;
  storage: StorageProvider;
  passwords: PasswordHasher;
  loginThrottle: LoginThrottle;
  emailSender: EmailSender;
  emails: NotificationEmails;
  clock: Clock;
  logger: Logger;
}

/** Every page of a list, one after the other. */
async function collect<T>(fetch: (cursor?: string) => Promise<PageResult<T>>): Promise<T[]> {
  const all: T[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < MAX_PAGES; page++) {
    const result = await fetch(cursor);
    all.push(...result.items);
    if (!result.nextCursor) break;
    cursor = result.nextCursor;
  }
  return all;
}

/**
 * Applies `act` to every record matching a query, until none is left. `act` must take the record
 * out of the query (e.g. cancel an active claim), so the first page is always the next batch.
 */
async function drain<T>(fetch: () => Promise<PageResult<T>>, act: (record: T) => Promise<unknown>) {
  for (let page = 0; page < MAX_PAGES; page++) {
    const { items } = await fetch();
    if (items.length === 0) return;
    for (const record of items) await act(record);
  }
}

/**
 * The person's own account as a whole: download everything it holds, or delete it.
 * It works across modules (posts, claims, notifications, sessions), reusing their use cases so
 * the same rules apply as when the person does each step by hand.
 */
export class AccountService {
  constructor(private readonly deps: AccountServiceDeps) {}

  async exportData(actor: Actor): Promise<AccountExportDto> {
    const { items, notifications, claimService, clock } = this.deps;
    const user = await this.requireUser(actor);
    const scope = { universityId: user.universityId };
    const me: Actor = { userId: user.id, role: user.role };

    const [posts, claimsMade, claimsReceived, notices] = await Promise.all([
      collect((cursor) =>
        items.search(
          scope,
          { reporterId: user.id, statuses: ITEM_STATUSES },
          { cursor, limit: PAGE_SIZE },
        ),
      ),
      collect((cursor) => claimService.listMine(me, scope, { cursor, limit: PAGE_SIZE })),
      collect((cursor) => claimService.listReceived(me, scope, { cursor, limit: PAGE_SIZE })),
      collect((cursor) =>
        notifications.listForUser(user.id, { unreadOnly: false }, { cursor, limit: PAGE_SIZE }),
      ),
    ]);

    return {
      exportedAt: clock.now().toISOString(),
      account: toMeDto(user),
      posts: posts.map((item) => toItemDto({ item, reporter: user }, user.id)),
      claimsMade: claimsMade.map((view) => toClaimDto(view, me)),
      claimsReceived: claimsReceived.map((view) => toClaimDto(view, me)),
      notifications: notices.map(toNotificationDto),
    };
  }

  /**
   * Deletes the account for good, after checking the password (wrong ones count as failed
   * sign-ins). Active claims are withdrawn and posts still in play removed, which tells the
   * other people involved. Finished handovers stay in the other person's history, shown as
   * "Former member". Then the person, their sessions, notifications and picture are deleted.
   *
   * Each step only touches what is still left, so a deletion that failed halfway can be retried.
   */
  async deleteAccount(
    actor: Actor,
    { password }: DeleteAccountInput,
    client: { ip: string | null },
  ): Promise<void> {
    const { users, items, claims, claimService, itemService, loginThrottle, passwords, clock } =
      this.deps;
    const user = await this.requireUser(actor);
    user.assertEditable(); // demo accounts are shared by every visitor
    await loginThrottle.assertAllowed(user.email, client.ip);
    if (!(await passwords.verify(password, user.passwordHash))) {
      await loginThrottle.recordFailure(user.email, client.ip);
      throw new ValidationError('Your password is incorrect.', [
        { path: 'body.password', message: 'Your password is incorrect' },
      ]);
    }
    const scope = { universityId: user.universityId };
    const me: Actor = { userId: user.id, role: user.role };

    // An approved claim of theirs reopens the item for others.
    await drain(
      () =>
        claims.search(
          scope,
          { claimantId: user.id, statuses: ['REQUESTED', 'APPROVED'] },
          { limit: PAGE_SIZE },
        ),
      (claim) => claimService.cancel(me, scope, claim.id),
    );
    // Claims on these posts are closed by CloseClaimsWhenItemEnds, which tells the claimants.
    await drain(
      () =>
        items.search(
          scope,
          { reporterId: user.id, statuses: ['OPEN', 'RESERVED'] },
          { limit: PAGE_SIZE },
        ),
      (item) => itemService.remove(me, scope, item.id),
    );

    const picture = user.close(clock.now());
    await users.delete(user);
    await Promise.all([
      this.deps.sessions.deleteAllForUser(user.id),
      this.deps.notifications.deleteAllForUser(user.id),
    ]);
    if (picture)
      await this.quietly('delete the picture', () => this.deps.storage.delete(picture.publicId));
    await this.quietly('send the goodbye email', () => this.sendGoodbye(user));
  }

  private async requireUser(actor: Actor): Promise<User> {
    const user = await this.deps.users.findById(actor.userId);
    if (!user) throw new UnauthorizedError('Your session has ended. Please sign in again.');
    return user;
  }

  private sendGoodbye(user: User): Promise<void> {
    return this.deps.emailSender.send(
      this.deps.emails.compose({
        to: user.email,
        firstName: user.profile.firstName,
        subject: 'Your account was deleted',
        heading: 'Your account was deleted',
        paragraphs: [
          'Your account and your personal details were deleted, and you were signed out on every device.',
          'Your open posts were removed and your active claims withdrawn. Handovers you finished stay in the other person’s history, without your name.',
          'If you didn’t do this, contact the administrators of your university.',
        ],
      }),
    );
  }

  /** The account is already gone: a leftover file or a lost email must not fail the request. */
  private async quietly(what: string, step: () => Promise<void>): Promise<void> {
    try {
      await step();
    } catch (err) {
      this.deps.logger.warn({ err }, `Account deleted, but could not ${what}`);
    }
  }
}
