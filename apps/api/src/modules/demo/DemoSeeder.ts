import { randomBytes } from 'node:crypto';
import type { Actor } from '../../core/domain/Actor';
import type { IdGenerator } from '../../core/domain/IdGenerator';
import type { Logger } from '../../core/logger/logger';
import type { PasswordHasher } from '../../core/security/PasswordHasher';
import type { StorageProvider } from '../../core/storage/StorageProvider';
import type { ClaimService } from '../claims/claim.service';
import { Item } from '../items/domain/Item';
import type { ItemRepository } from '../items/domain/ItemRepository';
import type { University } from '../universities/domain/University';
import type { UniversityRepository } from '../universities/domain/UniversityRepository';
import { DEMO_EMAIL_DOMAIN, User } from '../users/domain/User';
import type { UserRepository } from '../users/domain/UserRepository';
import type { DemoClock } from './DemoClock';
import type { DemoDataStore } from './DemoDataStore';
import { DEMO_PEOPLE, DEMO_POSTS, type DemoPost } from './demoData';
import { SAMPLE_PHOTO_PREFIX } from './infrastructure/MongoDemoDataStore';

/**
 * How often DEMO_MODE puts the sample data back. Demo accounts are shared, so one visitor's claim
 * changes the story for the next; hourly keeps it fresh, while most visits are much shorter.
 */
export const DEMO_RESET_INTERVAL_SECONDS = 60 * 60;

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

export interface DemoSeederDeps {
  universities: UniversityRepository;
  users: UserRepository;
  items: ItemRepository;
  /** A ClaimService on the demo clock, so claims, approvals and handovers are dated in the past. */
  claims: ClaimService;
  clock: DemoClock;
  store: DemoDataStore;
  storage: StorageProvider;
  passwords: PasswordHasher;
  ids: IdGenerator;
  logger: Logger;
  universitySlug: string;
}

export interface DemoSeedResult {
  people: number;
  posts: number;
}

/**
 * Creates, removes and resets the sample data. Everything goes through the domain and the real
 * claim service, and is saved with its events, so the history, notifications, audit entries
 * and statistics are those real use would produce.
 */
export class DemoSeeder {
  constructor(private readonly deps: DemoSeederDeps) {}

  async isSeeded(): Promise<boolean> {
    return (await this.deps.store.findDemoUserIds()).length > 0;
  }

  /** Creates the sample data unless it is already there. */
  async seed(now: Date = new Date()): Promise<DemoSeedResult | null> {
    if (await this.isSeeded()) return null;
    const university = await this.university();
    const people = await this.createPeople(university, now);
    await this.createPosts(university, people, now);
    this.deps.logger.info({ people: people.size, posts: DEMO_POSTS.length }, 'Demo data created');
    return { people: people.size, posts: DEMO_POSTS.length };
  }

  /** Deletes all sample data, including anything visitors added while signed in as a demo account. */
  async remove(): Promise<Record<string, number>> {
    const ids = await this.deps.store.findDemoUserIds();
    if (ids.length === 0) return {};
    const removed = await this.removeData(ids, { keepAccounts: false });
    this.deps.logger.info({ removed }, 'Demo data removed');
    return removed;
  }

  /**
   * Back to the original sample data (hourly, undoing what visitors changed). The demo accounts
   * and their sessions are kept, so visitors signed in at that moment stay signed in and just
   * see the story start again. If an account is missing or was suspended, everything is rebuilt.
   */
  async reset(now: Date = new Date()): Promise<DemoSeedResult | null> {
    const people = await this.existingPeople();
    if (!people) {
      await this.remove();
      return this.seed(now);
    }
    const removed = await this.removeData(
      [...people.values()].map((user) => user.id),
      { keepAccounts: true },
    );
    await this.createPosts(await this.university(), people, now);
    this.deps.logger.info({ removed, posts: DEMO_POSTS.length }, 'Demo data reset');
    return { people: people.size, posts: DEMO_POSTS.length };
  }

  private async university(): Promise<University> {
    const university = await this.deps.universities.findBySlug(this.deps.universitySlug);
    if (!university)
      throw new Error(`No university "${this.deps.universitySlug}". Run the seed first.`);
    return university;
  }

  /** Every sample person's account, if all of them exist and are active. */
  private async existingPeople(): Promise<Map<string, User> | null> {
    const people = new Map<string, User>();
    for (const person of DEMO_PEOPLE) {
      const user = await this.deps.users.findByEmail(`${person.key}@${DEMO_EMAIL_DOMAIN}`);
      if (!user || !user.isActive) return null;
      people.set(person.key, user);
    }
    return people;
  }

  private async createPeople(university: University, now: Date): Promise<Map<string, User>> {
    const { users, passwords, ids } = this.deps;
    // Demo accounts sign in only through the demo sign-in; nobody knows this password.
    const passwordHash = await passwords.hash(randomBytes(24).toString('base64url'));
    const oldest = Math.max(...DEMO_POSTS.map((p) => p.daysAgo)) + 7;
    const people = new Map<string, User>();
    for (const [index, person] of DEMO_PEOPLE.entries()) {
      const user = User.register({
        id: ids.next(),
        universityId: university.id,
        email: `${person.key}@${DEMO_EMAIL_DOMAIN}`,
        passwordHash,
        profile: {
          firstName: person.firstName,
          lastName: person.lastName,
          year: person.year,
          school: university.schools[index % university.schools.length] ?? 'Not specified',
          enrollmentNumber: `DEMO${String(index + 1).padStart(3, '0')}`,
          phone: null,
        },
        now: new Date(now.getTime() - (oldest - index) * DAY_MS),
      });
      await users.create(user);
      people.set(person.key, user);
    }
    return people;
  }

  private async createPosts(
    university: University,
    people: ReadonlyMap<string, User>,
    now: Date,
  ): Promise<void> {
    const { items, clock, ids } = this.deps;
    const actor = (key: string): Actor => {
      const user = people.get(key);
      if (!user) throw new Error(`Unknown demo person "${key}"`);
      return { userId: user.id, role: user.role };
    };
    const scope = { universityId: university.id };

    for (const post of DEMO_POSTS) {
      const postedAt = new Date(now.getTime() - post.daysAgo * DAY_MS - 3 * HOUR_MS);
      const item = Item.report({
        id: ids.next(),
        universityId: university.id,
        reporterId: actor(post.reporter).userId,
        type: post.type,
        category: post.category,
        title: post.title,
        description: post.description,
        location: post.location,
        occurredOn: dayOf(postedAt),
        images: [
          { url: `/demo/${post.photo}.jpg`, publicId: `${SAMPLE_PHOTO_PREFIX}${post.photo}` },
        ],
        questions: post.questions,
        heldAtSecurityDesk: post.heldAtSecurityDesk,
        now: postedAt,
      });
      await items.create(item);
      await this.play(post, item.id, scope, actor, postedAt, now);
    }
    clock.set(now);
  }

  private async removeData(
    userIds: readonly string[],
    options: { keepAccounts: boolean },
  ): Promise<Record<string, number>> {
    const { photoIds, removed } = await this.deps.store.removeAll(userIds, options);
    for (const photoId of photoIds) {
      await this.deps.storage.delete(photoId).catch((err: unknown) => {
        this.deps.logger.warn({ err, photoId }, 'Could not delete a demo upload');
      });
    }
    return removed;
  }

  /** Runs a post's story through the real claim service, at the right moments. */
  private async play(
    post: DemoPost,
    itemId: string,
    scope: { universityId: string },
    actor: (key: string) => Actor,
    postedAt: Date,
    now: Date,
  ): Promise<void> {
    const { outcome } = post;
    if (outcome.kind === 'open') return;
    const { claims, clock } = this.deps;
    const at = (hoursAfterPost: number) =>
      clock.set(
        new Date(Math.min(postedAt.getTime() + hoursAfterPost * HOUR_MS, now.getTime() - HOUR_MS)),
      );

    at(4);
    const submitted = await claims.submit(actor(outcome.claimant), scope, itemId, {
      message:
        post.type === 'FOUND'
          ? 'I think this is mine. Happy to answer anything else.'
          : 'I found this. I can bring it to the library.',
      answers: (post.questions ?? []).map((_, i) => ({
        questionId: `q${i + 1}`,
        answer: outcome.answers?.[i] ?? 'I can describe it in person',
      })),
      sharePhone: false,
    });
    at(8);
    const approved = await claims.approve(actor(post.reporter), scope, submitted.claim.id, {
      sharePhone: false,
    });
    if (outcome.kind === 'reserved') return;

    // The finder enters the owner's code: the reporter for a LOST item, the claimant for a FOUND one.
    const finder = post.type === 'FOUND' ? post.reporter : outcome.claimant;
    const code = approved.claim.handover?.code;
    if (!code) throw new Error('Approved claim without a handover code');
    at(outcome.daysToReturn * 24);
    await claims.confirmHandover(actor(finder), scope, submitted.claim.id, code);
  }
}

/** The calendar day of a moment, as stored for `occurredOn` (UTC midnight). */
function dayOf(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}
