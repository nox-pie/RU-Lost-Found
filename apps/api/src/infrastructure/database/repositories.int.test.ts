import { beforeAll, describe, expect, it } from 'vitest';
import { ConcurrencyError, ConflictError } from '../../core/errors/AppError';
import { MongoClaimRepository } from '../../modules/claims/infrastructure/MongoClaimRepository';
import { MongoItemRepository } from '../../modules/items/infrastructure/MongoItemRepository';
import { MongoUniversityRepository } from '../../modules/universities/infrastructure/MongoUniversityRepository';
import { MongoUserRepository } from '../../modules/users/infrastructure/MongoUserRepository';
import {
  T0,
  aClaimOn,
  aFoundItem,
  aLostItem,
  aUniversity,
  aUser,
  anActor,
  daysAfter,
  ids,
  minutesAfter,
  reporterOf,
} from '../../testing/builders';
import { useTestDatabase } from '../../testing/testDatabase';
import { MongoUnitOfWork } from './MongoUnitOfWork';

const db = useTestDatabase();
const LATER = minutesAfter(T0, 10);

let universities: MongoUniversityRepository;
let users: MongoUserRepository;
let items: MongoItemRepository;
let claims: MongoClaimRepository;
let unitOfWork: MongoUnitOfWork;

beforeAll(async () => {
  universities = new MongoUniversityRepository(db.connection);
  users = new MongoUserRepository(db.connection);
  items = new MongoItemRepository(db.connection);
  claims = new MongoClaimRepository(db.connection);
  unitOfWork = new MongoUnitOfWork(db.connection);
  await Promise.all([universities, users, items, claims].map((repo) => repo.ensureIndexes()));
});

describe('MongoUniversityRepository', () => {
  it('finds the active university for an email, including subdomains', async () => {
    const university = aUniversity({ emailDomains: ['rishihood.edu.in'] });
    await universities.create(university);

    const found = await universities.findByEmail('prashant@nst.rishihood.edu.in');

    expect(found?.id).toBe(university.id);
    expect(await universities.findByEmail('someone@gmail.com')).toBeNull();
    expect((await universities.findBySlug(university.slug))?.id).toBe(university.id);
  });

  it('prefers the university that owns an email domain over one open to any email', async () => {
    const open = aUniversity({ emailDomains: ['*'] });
    const rishihood = aUniversity({ emailDomains: ['rishihood.edu.in'] });
    await universities.create(open);
    await universities.create(rishihood);

    expect((await universities.findByEmail('asha@nst.rishihood.edu.in'))?.id).toBe(rishihood.id);
    expect((await universities.findByEmail('recruiter@gmail.com'))?.id).toBe(open.id);
    expect(await universities.findByEmail('not-an-email')).toBeNull();
  });

  it('rejects a duplicate slug', async () => {
    await universities.create(aUniversity({ slug: 'rishihood' }));

    await expect(universities.create(aUniversity({ slug: 'rishihood' }))).rejects.toThrow(
      'A university with this slug already exists.',
    );
  });
});

describe('MongoUserRepository', () => {
  it('saves and loads a user with every field intact', async () => {
    const user = aUser();
    user.changeAvatar({ url: 'https://img.example/a.jpg', publicId: 'avatars/a' }, LATER);
    await users.create(user);

    const loaded = await users.findByEmail(user.email.toUpperCase());

    expect(loaded).not.toBeNull();
    expect(loaded?.version).toBe(1);
    expect(loaded?.profile).toEqual(user.profile);
    expect(loaded?.universityId).toBe(user.universityId);
    expect(loaded?.createdAt).toEqual(T0);
  });

  it('returns null for malformed and unknown ids', async () => {
    expect(await users.findById('not-an-id')).toBeNull();
    expect(await users.findById(ids.next())).toBeNull();
  });

  it('enforces unique emails', async () => {
    await users.create(aUser({ email: 'asha@rishihood.edu.in' }));

    await expect(users.create(aUser({ email: 'ASHA@rishihood.edu.in' }))).rejects.toThrow(
      'An account with this email already exists.',
    );
  });

  it('refuses to overwrite a newer version (optimistic concurrency)', async () => {
    const user = aUser();
    await users.create(user);
    const tabA = await users.findById(user.id);
    const tabB = await users.findById(user.id);

    tabA!.updateProfile({ firstName: 'From A' }, LATER);
    await users.update(tabA!);
    tabB!.updateProfile({ firstName: 'From B' }, LATER);

    await expect(users.update(tabB!)).rejects.toThrow(ConcurrencyError);
    expect((await users.findById(user.id))?.profile.firstName).toBe('From A');
    expect(tabA!.version).toBe(2);
  });
});

describe('MongoItemRepository', () => {
  it('round-trips an item and keeps it inside its university', async () => {
    const item = aFoundItem({ questions: ['Colour?', 'Brand?'], heldAtSecurityDesk: true });
    await items.create(item);

    const loaded = await items.findById({ universityId: item.universityId }, item.id);
    const fromOtherUniversity = await items.findById({ universityId: ids.next() }, item.id);

    expect(loaded).toMatchObject({
      id: item.id,
      type: 'FOUND',
      status: 'OPEN',
      title: item.title,
      heldAtSecurityDesk: true,
      resolvedAt: null,
    });
    expect(loaded?.verificationQuestions).toEqual(item.verificationQuestions);
    expect(loaded?.images).toEqual(item.images);
    expect(fromOtherUniversity).toBeNull();
  });

  it('persists status changes', async () => {
    const item = aFoundItem();
    await items.create(item);

    item.reserve(LATER);
    item.resolve(LATER);
    await items.update(item);

    const loaded = await items.findById({ universityId: item.universityId }, item.id);
    expect(loaded?.status).toBe('RESOLVED');
    expect(loaded?.resolvedAt).toEqual(LATER);
  });
});

describe('MongoClaimRepository', () => {
  it('round-trips a claim with its handover and history', async () => {
    const item = aFoundItem();
    const claim = aClaimOn(item);
    claim.approve(reporterOf(item), { code: '123456', deadline: daysAfter(T0, 7) }, LATER);
    await claims.create(claim);

    const loaded = await claims.findById({ universityId: item.universityId }, claim.id);

    expect(loaded?.status).toBe('APPROVED');
    expect(loaded?.handover).toEqual(claim.handover);
    expect(loaded?.history).toEqual(claim.history);
    expect(loaded?.answers).toEqual(claim.answers);
  });

  it('allows only one active claim per person per item', async () => {
    const item = aFoundItem();
    const claimant = anActor();
    await claims.create(aClaimOn(item, claimant));

    await expect(claims.create(aClaimOn(item, claimant))).rejects.toThrow(
      'You already have an active claim on this item.',
    );
  });

  it('allows a new claim once the previous one is no longer active', async () => {
    const item = aFoundItem();
    const claimant = anActor();
    const first = aClaimOn(item, claimant);
    await claims.create(first);
    first.cancel(claimant, LATER);
    await claims.update(first);

    await expect(claims.create(aClaimOn(item, claimant))).resolves.toBeUndefined();
  });

  it('allows only one approved claim per item, even if two requests race', async () => {
    const item = aFoundItem();
    const first = aClaimOn(item);
    const second = aClaimOn(item);
    await claims.create(first);
    await claims.create(second);

    first.approve(reporterOf(item), { code: '111111', deadline: daysAfter(T0, 7) }, LATER);
    second.approve(reporterOf(item), { code: '222222', deadline: daysAfter(T0, 7) }, LATER);
    await claims.update(first);

    await expect(claims.update(second)).rejects.toThrow(ConflictError);
  });

  it('lists active claims on an item and finds overdue approvals', async () => {
    const item = aLostItem();
    const requested = aClaimOn(item, anActor(), { answers: [] });
    const approved = aClaimOn(item, anActor(), { answers: [] });
    const cancelled = aClaimOn(item, anActor(), { answers: [] });
    approved.approve(reporterOf(item), { code: '123456', deadline: daysAfter(T0, 7) }, LATER);
    cancelled.cancel(reporterOf(item), LATER);
    await Promise.all([requested, approved, cancelled].map((c) => claims.create(c)));

    const active = await claims.findActiveByItem({ universityId: item.universityId }, item.id);
    const overdueNow = await claims.findOverdueApproved(daysAfter(T0, 1), 10);
    const overdueLater = await claims.findOverdueApproved(daysAfter(T0, 8), 10);

    expect(active.map((c) => c.id).sort()).toEqual([requested.id, approved.id].sort());
    expect(overdueNow).toEqual([]);
    expect(overdueLater.map((c) => c.id)).toEqual([approved.id]);
    expect(
      await claims.findActiveByItemAndClaimant(
        { universityId: item.universityId },
        item.id,
        requested.claimantId,
      ),
    ).not.toBeNull();
  });
});

describe('MongoUnitOfWork', () => {
  it('commits every write in the transaction together', async () => {
    const item = aFoundItem();
    const claim = aClaimOn(item);

    await unitOfWork.run(async (tx) => {
      await items.create(item, tx);
      await claims.create(claim, tx);
    });

    const scope = { universityId: item.universityId };
    expect(await items.findById(scope, item.id)).not.toBeNull();
    expect(await claims.findById(scope, claim.id)).not.toBeNull();
  });

  it('rolls back every write if anything fails', async () => {
    const item = aFoundItem();

    await expect(
      unitOfWork.run(async (tx) => {
        await items.create(item, tx);
        throw new Error('email provider exploded');
      }),
    ).rejects.toThrow('email provider exploded');

    expect(await items.findById({ universityId: item.universityId }, item.id)).toBeNull();
  });

  it('rolls back when a unique rule is broken mid-transaction', async () => {
    const item = aFoundItem();
    const claimant = anActor();
    await claims.create(aClaimOn(item, claimant));
    const scope = { universityId: item.universityId };

    await expect(
      unitOfWork.run(async (tx) => {
        item.reserve(LATER);
        await items.create(item, tx);
        await claims.create(aClaimOn(aFoundItem({ id: item.id }), claimant), tx);
      }),
    ).rejects.toThrow(ConflictError);

    expect(await items.findById(scope, item.id)).toBeNull();
  });
});
