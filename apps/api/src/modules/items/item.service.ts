import {
  LISTABLE_ITEM_STATUSES,
  type CreateItemInput,
  type ListItemsQuery,
  type PageQuery,
  type UpdateItemInput,
} from '@ru-lost-found/shared';
import type { Actor } from '../../core/domain/Actor';
import type { Clock } from '../../core/domain/Clock';
import type { IdGenerator } from '../../core/domain/IdGenerator';
import type { ImageRef } from '../../core/domain/ImageRef';
import { NotFoundError, ValidationError } from '../../core/errors/AppError';
import type { Logger } from '../../core/logger/logger';
import type { PageResult } from '../../core/persistence/Pagination';
import type { TenantScope } from '../../core/persistence/Repository';
import type { ImageUpload, StorageProvider } from '../../core/storage/StorageProvider';
import type { UserRepository } from '../users/domain/UserRepository';
import { Item } from './domain/Item';
import type { ItemRepository } from './domain/ItemRepository';
import type { ItemView } from './item.mapper';

/** "2026-10-01" → 2026-10-01T00:00:00.000Z */
function parseDateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

export class ItemService {
  constructor(
    private readonly items: ItemRepository,
    private readonly users: UserRepository,
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
        occurredOn: parseDateOnly(input.occurredOn),
        images: uploaded,
        questions: input.questions,
        heldAtSecurityDesk: input.heldAtSecurityDesk,
        now: this.clock.now(),
      });
      await this.items.create(item);
      return { item, reporter: (await this.users.findById(actor.userId)) ?? undefined };
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
      { text: query.q, type: query.type, category: query.category, statuses: query.status },
      { cursor: query.cursor, limit: query.limit },
    );
    return { items: await this.withReporters(page.items), nextCursor: page.nextCursor };
  }

  /** Everything the user reported, in any status except removed. */
  async listMine(
    actor: Actor,
    scope: TenantScope,
    query: PageQuery,
  ): Promise<PageResult<ItemView>> {
    const page = await this.items.search(
      scope,
      { reporterId: actor.userId, statuses: LISTABLE_ITEM_STATUSES },
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
    const item = await this.requireVisible(scope, id);
    const { occurredOn, ...rest } = changes;
    item.edit(
      actor,
      { ...rest, ...(occurredOn ? { occurredOn: parseDateOnly(occurredOn) } : {}) },
      this.clock.now(),
    );
    await this.items.update(item);
    const [view] = await this.withReporters([item]);
    return view as ItemView;
  }

  /**
   * Soft delete: the item disappears from every list but is kept (with its photos) for moderation.
   * Photos of removed items are deleted later by a scheduled clean-up.
   */
  async remove(actor: Actor, scope: TenantScope, id: string): Promise<void> {
    const item = await this.requireVisible(scope, id);
    item.remove(actor, this.clock.now());
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
