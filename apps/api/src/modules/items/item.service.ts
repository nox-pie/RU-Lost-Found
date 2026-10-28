import {
  FEED_TABS,
  ITEM_STATUSES,
  LISTABLE_ITEM_STATUSES,
  type ListAdminItemsQuery,
  type CloseItemInput,
  type CreateItemInput,
  type DeskItemsQuery,
  type ItemCountsDto,
  type ItemCountsQuery,
  type ItemStatus,
  type ItemType,
  type ListItemsQuery,
  type PageQuery,
  type UpdateItemInput,
} from '@ru-lost-found/shared';
import type { Actor } from '../../core/domain/Actor';
import type { Clock } from '../../core/domain/Clock';
import type { IdGenerator } from '../../core/domain/IdGenerator';
import type { ImageRef } from '../../core/domain/ImageRef';
import {
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '../../core/errors/AppError';
import type { Logger } from '../../core/logger/logger';
import type { PageResult } from '../../core/persistence/Pagination';
import type { TenantScope } from '../../core/persistence/Repository';
import type { ImageUpload, StorageProvider } from '../../core/storage/StorageProvider';
import type { UniversityRepository } from '../universities/domain/UniversityRepository';
import type { User } from '../users/domain/User';
import type { UserRepository } from '../users/domain/UserRepository';
import { Item, REMINDER_DAYS } from './domain/Item';
import type { FeedCriteria, ItemRepository } from './domain/ItemRepository';
import type { ItemView } from './item.mapper';

const DAY_MS = 24 * 60 * 60 * 1000;

/** "2026-10-01" → 2026-10-01T00:00:00.000Z */
function parseDateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

/** The browse filters of a list or count request, as repository criteria. */
function feedCriteria(query: ItemCountsQuery): FeedCriteria {
  return {
    text: query.q,
    category: query.category,
    place: query.place,
    occurredFrom: query.occurredFrom ? parseDateOnly(query.occurredFrom) : undefined,
    occurredTo: query.occurredTo ? parseDateOnly(query.occurredTo) : undefined,
  };
}

export class ItemService {
  constructor(
    private readonly items: ItemRepository,
    private readonly users: UserRepository,
    private readonly universities: UniversityRepository,
    private readonly storage: StorageProvider,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
    private readonly logger: Logger,
  ) {}

  /**
   * Uploads the photos, then saves the item. If anything fails after an upload, the uploaded
   * photos are deleted again (a compensating action), so storage never fills with orphans.
   */
  async report(
    actor: Actor,
    scope: TenantScope,
    input: CreateItemInput,
    photos: ImageUpload[],
  ): Promise<ItemView> {
    const reporter = await this.assertMayChangePosts(actor);
    // Checked before uploading, so a refused post leaves no photos behind.
    const place = await this.validPlace(scope, input.place);
    if (photos.length === 0) {
      throw new ValidationError('Add at least one photo of the item.', [
        { path: 'photos', message: 'At least one photo is required' },
      ]);
    }

    const uploaded: ImageRef[] = [];
    try {
      const results = await Promise.allSettled(
        photos.map((photo) => this.storage.upload(photo, 'items')),
      );
      for (const result of results) {
        if (result.status === 'fulfilled') uploaded.push(result.value);
      }
      const failure = results.find((result) => result.status === 'rejected');
      if (failure) throw failure.reason;

      const item = Item.report({
        id: this.ids.next(),
        universityId: scope.universityId,
        reporterId: actor.userId,
        type: input.type,
        category: input.category,
        title: input.title,
        description: input.description,
        location: input.location,
        place,
        occurredOn: parseDateOnly(input.occurredOn),
        images: uploaded,
        questions: input.questions,
        heldAtSecurityDesk: input.heldAtSecurityDesk,
        now: this.clock.now(),
      });
      await this.items.create(item);
      return { item, reporter };
    } catch (error) {
      await this.deleteQuietly(uploaded);
      throw error;
    }
  }

  /** A visible item of the university. Removed items are treated as not found. */
  async get(scope: TenantScope, id: string): Promise<ItemView> {
    const item = await this.requireVisible(scope, id);
    const [view] = await this.withReporters([item]);
    return view as ItemView;
  }

  async search(scope: TenantScope, query: ListItemsQuery): Promise<PageResult<ItemView>> {
    const page = await this.items.search(
      scope,
      { ...feedCriteria(query), type: query.type, statuses: query.status },
      { cursor: query.cursor, limit: query.limit },
    );
    return { items: await this.withReporters(page.items), nextCursor: page.nextCursor };
  }

  /** How many posts each browse tab shows for the same filters (see FEED_TABS). */
  async countByTab(scope: TenantScope, query: ItemCountsQuery): Promise<ItemCountsDto> {
    const tallies = await this.items.tally(scope, feedCriteria(query));
    const count = (tab: { type?: ItemType; statuses: readonly ItemStatus[] }) =>
      tallies
        .filter((t) => (!tab.type || t.type === tab.type) && tab.statuses.includes(t.status))
        .reduce((sum, t) => sum + t.count, 0);
    return {
      all: count(FEED_TABS.all),
      lost: count(FEED_TABS.lost),
      found: count(FEED_TABS.found),
      returned: count(FEED_TABS.returned),
    };
  }

  /** Every post of the university, removed ones included (admin "Posts" tab). */
  async listAll(scope: TenantScope, query: ListAdminItemsQuery): Promise<PageResult<ItemView>> {
    const page = await this.items.search(
      scope,
      {
        text: query.q,
        type: query.type,
        category: query.category,
        statuses: query.status ?? ITEM_STATUSES,
      },
      { cursor: query.cursor, limit: query.limit },
    );
    return { items: await this.withReporters(page.items), nextCursor: page.nextCursor };
  }

  /** Everything the user reported, closed posts included, in any status except removed. */
  async listMine(
    actor: Actor,
    scope: TenantScope,
    query: PageQuery,
  ): Promise<PageResult<ItemView>> {
    const page = await this.items.search(
      scope,
      { reporterId: actor.userId, statuses: [...LISTABLE_ITEM_STATUSES, 'CLOSED'] },
      { cursor: query.cursor, limit: query.limit },
    );
    return { items: await this.withReporters(page.items), nextCursor: page.nextCursor };
  }

  /**
   * Security desk console: found items handed in at the desk that haven't gone back to their
   * owner yet (open, or reserved for an approved claim). Staff only (checked by the route).
   */
  async listAtDesk(scope: TenantScope, query: DeskItemsQuery): Promise<PageResult<ItemView>> {
    const page = await this.items.search(
      scope,
      { text: query.q, type: 'FOUND', heldAtSecurityDesk: true, statuses: ['OPEN', 'RESERVED'] },
      { cursor: query.cursor, limit: query.limit },
    );
    return { items: await this.withReporters(page.items), nextCursor: page.nextCursor };
  }

  async edit(
    actor: Actor,
    scope: TenantScope,
    id: string,
    changes: UpdateItemInput,
  ): Promise<ItemView> {
    await this.assertMayChangePosts(actor);
    const item = await this.requireVisible(scope, id);
    const { occurredOn, place, ...rest } = changes;
    if (place) await this.validPlace(scope, place);
    item.edit(
      actor,
      {
        ...rest,
        ...(place !== undefined ? { place } : {}),
        ...(occurredOn ? { occurredOn: parseDateOnly(occurredOn) } : {}),
      },
      this.clock.now(),
    );
    await this.items.update(item);
    const [view] = await this.withReporters([item]);
    return view as ItemView;
  }

  /** The reporter closes their open post: back with its owner another way, or no longer needed. */
  async close(
    actor: Actor,
    scope: TenantScope,
    id: string,
    { reason }: CloseItemInput,
  ): Promise<ItemView> {
    await this.assertMayChangePosts(actor);
    const item = await this.requireVisible(scope, id);
    item.close(actor, reason, this.clock.now());
    await this.items.update(item);
    const [view] = await this.withReporters([item]);
    return view as ItemView;
  }

  /** The reporter keeps an open post up for another stretch, or opens a closed one again. */
  async keepOpen(actor: Actor, scope: TenantScope, id: string): Promise<ItemView> {
    await this.assertMayChangePosts(actor);
    const item = await this.requireVisible(scope, id);
    item.keepOpen(actor, this.clock.now());
    await this.items.update(item);
    const [view] = await this.withReporters([item]);
    return view as ItemView;
  }

  /**
   * Scheduled job: reminds reporters of posts closing within REMINDER_DAYS, and closes posts
   * past their expiry whose reporter was reminded at least REMINDER_DAYS ago (the domain
   * decides; see Item.remindOfExpiry and Item.expire). One failure doesn't stop the rest.
   */
  async closeStalePosts(limit = 100): Promise<{ reminded: number; closed: number }> {
    const now = this.clock.now();
    const days = (n: number) => new Date(now.getTime() + n * DAY_MS);
    const step = async (items: Item[], act: (item: Item) => boolean) => {
      let done = 0;
      for (const item of items) {
        try {
          if (!act(item)) continue;
          await this.items.update(item);
          done += 1;
        } catch (err) {
          this.logger.warn({ err, itemId: item.id }, 'Could not update an expiring post');
        }
      }
      return done;
    };
    const reminded = await step(
      await this.items.findOpenNeedingReminder(days(REMINDER_DAYS), limit),
      (item) => item.remindOfExpiry(now),
    );
    const closed = await step(
      await this.items.findOpenToClose(now, days(-REMINDER_DAYS), limit),
      (item) => item.expire(now),
    );
    return { reminded, closed };
  }

  /**
   * Soft delete: the item disappears from every list but is kept (with its photos) for moderation.
   * Photos of removed items are deleted later by a scheduled clean-up.
   */
  async remove(actor: Actor, scope: TenantScope, id: string): Promise<void> {
    const user = await this.assertMayChangePosts(actor);
    const item = await this.requireVisible(scope, id);
    // Moderator rights come from the role stored now, not from the (up to 15-minute-old) token,
    // so a demoted admin can no longer remove other people's posts.
    item.remove({ userId: actor.userId, role: user.role }, this.clock.now());
    await this.items.update(item);
  }

  /**
   * Scheduled job: deletes the photos of items removed more than `afterDays` ago.
   * Photos are deleted from storage first; if that fails the item is left for the next run.
   * Returns how many items were cleaned up.
   */
  async purgeRemovedPhotos(afterDays = 30, limit = 50): Promise<number> {
    const cutoff = new Date(this.clock.now().getTime() - afterDays * 24 * 60 * 60 * 1000);
    const items = await this.items.findRemovedWithPhotos(cutoff, limit);
    let purged = 0;
    for (const item of items) {
      try {
        const photos = item.releasePhotos();
        await Promise.all(photos.map((photo) => this.storage.delete(photo.publicId)));
        await this.items.update(item);
        purged += 1;
      } catch (err) {
        this.logger.warn({ err, itemId: item.id }, 'Could not clean up photos of a removed item');
      }
    }
    return purged;
  }

  /** A place must be one of the university's (like a school at sign-up); none means elsewhere. */
  private async validPlace(scope: TenantScope, place: string | undefined): Promise<string | null> {
    if (!place) return null;
    const university = await this.universities.findById(scope.universityId);
    if (!university?.hasPlace(place)) {
      throw new ValidationError('The request is invalid.', [
        {
          path: 'body.place',
          message: `Choose a place of ${university?.name ?? 'your university'}`,
        },
      ]);
    }
    return place;
  }

  private async requireVisible(scope: TenantScope, id: string): Promise<Item> {
    const item = await this.items.findById(scope, id);
    if (!item || item.status === 'REMOVED') throw new NotFoundError('Item');
    return item;
  }

  /** Loads all reporters of a page in one query instead of one per item (no N+1). */
  private async withReporters(items: Item[]): Promise<ItemView[]> {
    const reporters = await this.users.findByIds(items.map((item) => item.reporterId));
    const byId = new Map(reporters.map((user) => [user.id, user]));
    return items.map((item) => ({ item, reporter: byId.get(item.reporterId) }));
  }

  /**
   * The account as it is now: a suspension applies at once, although the access token lives up
   * to 15 minutes. Anyone can sign in as a demo account, so it can't post (no uploads), and
   * can't edit or remove the sample posts every other visitor relies on. Returns the acting user.
   */
  private async assertMayChangePosts(actor: Actor): Promise<User> {
    const user = await this.users.findById(actor.userId);
    if (!user || !user.isActive) {
      throw new UnauthorizedError('Your session has ended. Please sign in again.');
    }
    if (user.isDemo) {
      throw new ForbiddenError(
        'Demo accounts can’t post, edit or remove items. Create your own account to do that.',
      );
    }
    return user;
  }

  private async deleteQuietly(images: ImageRef[]): Promise<void> {
    await Promise.all(
      images.map((image) =>
        this.storage.delete(image.publicId).catch((err: unknown) => {
          this.logger.warn({ err, publicId: image.publicId }, 'Could not delete orphaned image');
        }),
      ),
    );
  }
}
