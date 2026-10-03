import { Types, type Connection } from 'mongoose';
import { DEMO_EMAIL_DOMAIN } from '../../users/domain/User';
import type { DemoDataStore } from '../DemoDataStore';

/** The built-in sample photos are served by the web app; they are never deleted from storage. */
export const SAMPLE_PHOTO_PREFIX = 'demo/';

const escapeRegex = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Works on the collections directly: removal must reach records of several modules (users,
 * items, claims, moderation, notifications, sessions, audit, outbox) in one pass.
 */
export class MongoDemoDataStore implements DemoDataStore {
  constructor(private readonly connection: Connection) {}

  private col(name: string) {
    return this.connection.collection(name);
  }

  async findDemoUserIds(): Promise<string[]> {
    const users = await this.col('users')
      .find(
        { email: { $regex: `@${escapeRegex(DEMO_EMAIL_DOMAIN)}$` } },
        { projection: { _id: 1 } },
      )
      .toArray();
    return users.map((u) => String(u._id));
  }

  async removeAll(userIds: readonly string[]) {
    const users = userIds.map((id) => new Types.ObjectId(id));
    const items = await this.col('items')
      .find({ reporterId: { $in: users } }, { projection: { _id: 1, images: 1 } })
      .toArray();
    const itemIds = items.map((i) => i._id);
    const claims = await this.col('claims')
      .find(
        { $or: [{ itemId: { $in: itemIds } }, { claimantId: { $in: users } }] },
        { projection: { _id: 1 } },
      )
      .toArray();
    const claimIds = claims.map((c) => c._id);
    const reports = await this.col('moderation_reports')
      .find(
        { $or: [{ itemId: { $in: itemIds } }, { flaggedBy: { $in: users } }] },
        { projection: { _id: 1 } },
      )
      .toArray();
    const reportIds = reports.map((r) => r._id);
    const avatars = await this.col('users')
      .find({ _id: { $in: users } }, { projection: { 'profile.avatar': 1 } })
      .toArray();

    const allIds = [...users, ...itemIds, ...claimIds, ...reportIds].map(String);
    const photoIds = [
      ...items.flatMap((i) => ((i.images ?? []) as { publicId: string }[]).map((p) => p.publicId)),
      ...avatars.flatMap((u) => {
        const avatar = (u.profile as { avatar?: { publicId: string } | null } | undefined)?.avatar;
        return avatar ? [avatar.publicId] : [];
      }),
    ].filter((id) => !id.startsWith(SAMPLE_PHOTO_PREFIX));

    const removed: Record<string, number> = {};
    const remove = async (name: string, filter: Record<string, unknown>) => {
      removed[name] = (await this.col(name).deleteMany(filter)).deletedCount;
    };
    await remove('notifications', {
      $or: [
        { userId: { $in: users } },
        { itemId: { $in: itemIds } },
        { claimId: { $in: claimIds } },
      ],
    });
    await remove('audit_logs', {
      $or: [{ actorId: { $in: users } }, { targetId: { $in: allIds } }],
    });
    await remove('outbox_events', { aggregateId: { $in: allIds } });
    await remove('moderation_reports', { _id: { $in: reportIds } });
    await remove('claims', { _id: { $in: claimIds } });
    await remove('items', { _id: { $in: itemIds } });
    await remove('sessions', { userId: { $in: users } });
    await remove('users', { _id: { $in: users } });
    return { photoIds, removed };
  }
}
