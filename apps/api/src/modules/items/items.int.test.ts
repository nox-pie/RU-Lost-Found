import { FEED_TABS, MAX_PHOTO_BYTES } from '@ru-lost-found/shared';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { T0, minutesAfter } from '../../testing/builders';
import { fakeJpeg, fakePng, signUp, withRole, type SignedInUser } from '../../testing/signedIn';
import { seedUniversity, useTestApp } from '../../testing/testApp';
import { MongoItemRepository } from './infrastructure/MongoItemRepository';
import { ITEM_RATE_LIMITS } from './item.routes';

const t = useTestApp();
const api = () => request(t.app);

let asha: SignedInUser;
let ravi: SignedInUser;

beforeEach(async () => {
  await seedUniversity(t.connection);
  asha = await signUp(t, 'asha@nst.rishihood.edu.in', { firstName: 'Asha', lastName: 'Verma' });
  ravi = await signUp(t, 'ravi@rishihood.edu.in', { firstName: 'Ravi', lastName: 'Singh' });
});

type Fields = Record<string, string | string[]>;

function report(user: SignedInUser, overrides: Fields = {}, photos: Buffer[] = [fakeJpeg()]) {
  const fields: Fields = {
    type: 'FOUND',
    category: 'ELECTRONICS',
    title: 'Black phone',
    description: 'Found near the library entrance.',
    location: 'Library',
    occurredOn: '2026-10-01',
    ...overrides,
  };
  let req = api().post('/api/v1/items').set('Authorization', user.bearer);
  for (const [name, value] of Object.entries(fields)) {
    for (const one of ([] as string[]).concat(value)) req = req.field(name, one);
  }
  photos.forEach((photo, i) => {
    req = req.attach('photos', photo, `photo-${i}.jpg`);
  });
  return req;
}

async function setStatus(itemId: string, status: 'RESERVED' | 'RESOLVED') {
  const items = new MongoItemRepository(t.connection);
  const university = await api().get('/api/v1/users/me').set('Authorization', asha.bearer);
  const item = await items.findById({ universityId: university.body.universityId }, itemId);
  item!.reserve(T0);
  if (status === 'RESOLVED') item!.resolve(T0);
  await items.update(item!);
}

describe('reporting an item', () => {
  it('creates a found item with photos and verification questions', async () => {
    const res = await report(
      asha,
      {
        questions: ['What is the lock-screen wallpaper?', 'Which case is it in?'],
        heldAtSecurityDesk: 'true',
      },
      [fakeJpeg(), fakePng()],
    );

    expect(res.status).toBe(201);
    expect(res.headers.location).toBe(`/api/v1/items/${res.body.id}`);
    expect(res.body).toMatchObject({
      type: 'FOUND',
      category: 'ELECTRONICS',
      title: 'Black phone',
      occurredOn: '2026-10-01',
      status: 'OPEN',
      heldAtSecurityDesk: true,
      isMine: true,
      reporter: { id: asha.id, name: 'Asha Verma', avatarUrl: null },
      verificationQuestions: [
        { id: 'q1', question: 'What is the lock-screen wallpaper?' },
        { id: 'q2', question: 'Which case is it in?' },
      ],
    });
    expect(res.body.photos).toHaveLength(2);
    expect(t.storage.stored.size).toBe(2);
  });

  it('requires at least one photo', async () => {
    const res = await report(asha, {}, []);

    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual([
      { path: 'photos', message: 'At least one photo is required' },
    ]);
  });

  it('rejects files that are not really images, whatever their name says', async () => {
    const res = await report(asha, {}, [Buffer.from('<?php system($_GET["c"]); ?>')]);

    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/not a JPEG, PNG or WebP/);
    expect(t.storage.stored.size).toBe(0);
  });

  it('limits the number and size of photos', async () => {
    const tooMany = await report(asha, {}, [fakeJpeg(), fakeJpeg(), fakeJpeg(), fakeJpeg()]);
    const tooBig = await report(asha, {}, [fakeJpeg(MAX_PHOTO_BYTES)]);

    expect(tooMany.status).toBe(400);
    expect(tooBig.status).toBe(413);
    expect(tooBig.body.error.message).toBe('Each photo must be 5 MB or smaller.');
  });

  it('validates the text fields and reports every problem', async () => {
    const res = await report(asha, { category: 'SPACESHIP', title: 'x', occurredOn: '01/10/2026' });

    expect(res.status).toBe(400);
    expect(res.body.error.details.map((d: { path: string }) => d.path).sort()).toEqual([
      'body.category',
      'body.occurredOn',
      'body.title',
    ]);
  });

  it('deletes already-uploaded photos when a later upload fails', async () => {
    t.storage.failOnUpload = 2;

    const res = await report(asha, {}, [fakeJpeg(), fakeJpeg()]);

    expect(res.status).toBe(502);
    expect(t.storage.stored.size).toBe(0);
    expect(t.storage.deleted).toHaveLength(1);
  });

  it('deletes uploaded photos when the item is rejected by a business rule', async () => {
    const res = await report(asha, { type: 'LOST', questions: 'What colour is the case?' });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/Only found items/);
    expect(t.storage.stored.size).toBe(0);
  });

  it('limits how many items one person can report per day', async () => {
    const { limit } = ITEM_RATE_LIMITS.reportsPerUser;
    for (let i = 0; i < limit; i++) await report(asha).expect(201);

    const blocked = await report(asha);

    expect(blocked.status).toBe(429);
  });

  it('requires sign-in', async () => {
    expect((await api().get('/api/v1/items')).status).toBe(401);
    expect((await api().post('/api/v1/items')).status).toBe(401);
  });
});

describe('viewing items', () => {
  it('shows other students the item and reporter name, but no private details', async () => {
    const created = await report(asha);

    const res = await api()
      .get(`/api/v1/items/${created.body.id}`)
      .set('Authorization', ravi.bearer);

    expect(res.status).toBe(200);
    expect(res.body.isMine).toBe(false);
    expect(res.body.reporter).toEqual({ id: asha.id, name: 'Asha Verma', avatarUrl: null });
    expect(JSON.stringify(res.body)).not.toContain(asha.email);
  });

  it('keeps each university’s items private to it', async () => {
    await seedUniversity(t.connection, { slug: 'other-uni', emailDomains: ['other.edu'] });
    const outsider = await signUp(t, 'meera@other.edu', { school: 'School of Entrepreneurship' });
    const created = await report(asha);

    const single = await api()
      .get(`/api/v1/items/${created.body.id}`)
      .set('Authorization', outsider.bearer);
    const list = await api().get('/api/v1/items').set('Authorization', outsider.bearer);

    expect(single.status).toBe(404);
    expect(list.body.data).toEqual([]);
  });

  it('returns 400 for malformed ids and 404 for unknown ones', async () => {
    const malformed = await api().get('/api/v1/items/abc').set('Authorization', asha.bearer);
    const unknown = await api()
      .get('/api/v1/items/0123456789abcdef01234567')
      .set('Authorization', asha.bearer);

    expect(malformed.status).toBe(400);
    expect(unknown.status).toBe(404);
  });
});

describe('searching items', () => {
  async function reportAt(minutes: number, overrides: Fields) {
    t.clock.set(minutesAfter(T0, minutes));
    const res = await report(asha, overrides).expect(201);
    return res.body.id as string;
  }

  it('lists newest first and filters by type, category, status and words', async () => {
    const wallet = await reportAt(1, {
      type: 'LOST',
      category: 'WALLET',
      title: 'Brown leather wallet',
    });
    const keys = await reportAt(2, {
      category: 'KEYS',
      title: 'Bunch of keys',
      location: 'Hostel',
    });
    const bottle = await reportAt(3, { category: 'BOTTLE', title: 'Steel water bottle' });
    const resolved = await reportAt(4, { category: 'KEYS', title: 'Car key' });
    await setStatus(resolved, 'RESOLVED');

    const ids = async (query: string) =>
      (await api().get(`/api/v1/items${query}`).set('Authorization', ravi.bearer)).body.data.map(
        (item: { id: string }) => item.id,
      );

    expect(await ids('')).toEqual([bottle, keys, wallet]);
    expect(await ids('?type=LOST')).toEqual([wallet]);
    expect(await ids('?category=KEYS')).toEqual([keys]);
    expect(await ids('?status=RESOLVED')).toEqual([resolved]);
    expect(await ids('?status=OPEN,RESOLVED&category=KEYS')).toEqual([resolved, keys]);
    expect(await ids('?q=key')).toEqual([keys]);
    expect(await ids('?q=hostel')).toEqual([keys]);
  });

  it('counts the posts of each browse tab, matching what each tab lists', async () => {
    await reportAt(1, { type: 'LOST', category: 'WALLET', title: 'Brown leather wallet' });
    await reportAt(2, { category: 'KEYS', title: 'Bunch of keys' });
    await setStatus(await reportAt(3, { category: 'BOTTLE', title: 'Steel bottle' }), 'RESERVED');
    await setStatus(await reportAt(4, { category: 'KEYS', title: 'Car key' }), 'RESOLVED');
    const get = async (path: string) =>
      (await api().get(`/api/v1/items${path}`).set('Authorization', ravi.bearer).expect(200)).body;

    expect(await get('/counts')).toEqual({ all: 3, lost: 1, found: 1, returned: 1 });
    expect(await get('/counts?category=KEYS')).toEqual({ all: 1, lost: 0, found: 1, returned: 1 });
    expect(await get('/counts?q=wallet')).toEqual({ all: 1, lost: 1, found: 0, returned: 0 });
    const counts = await get('/counts');
    for (const [tab, filter] of Object.entries(FEED_TABS)) {
      const type = 'type' in filter ? `&type=${filter.type}` : '';
      const listed = await get(`?limit=50&status=${filter.statuses.join(',')}${type}`);
      expect(listed.data, tab).toHaveLength(counts[tab]);
    }
  });

  it('pages through results with a cursor, without repeats or gaps', async () => {
    const created: string[] = [];
    for (let i = 0; i < 5; i++) created.push(await reportAt(i, { title: `Item number ${i}` }));

    const seen: string[] = [];
    let cursor: string | null = null;
    let pages = 0;
    do {
      const res: request.Response = await api()
        .get(`/api/v1/items?limit=2${cursor ? `&cursor=${cursor}` : ''}`)
        .set('Authorization', ravi.bearer)
        .expect(200);
      seen.push(...res.body.data.map((item: { id: string }) => item.id));
      cursor = res.body.nextCursor;
      pages += 1;
    } while (cursor);

    expect(pages).toBe(3);
    expect(seen).toEqual([...created].reverse());
  });

  it('orders items created at the same moment consistently across pages', async () => {
    const created: string[] = [];
    for (let i = 0; i < 3; i++) created.push((await report(asha).expect(201)).body.id);

    const first = await api().get('/api/v1/items?limit=2').set('Authorization', ravi.bearer);
    const second = await api()
      .get(`/api/v1/items?limit=2&cursor=${first.body.nextCursor}`)
      .set('Authorization', ravi.bearer);

    const seen = [...first.body.data, ...second.body.data].map((item: { id: string }) => item.id);
    expect(new Set(seen).size).toBe(3);
    expect(second.body.nextCursor).toBeNull();
  });

  it('rejects a tampered cursor and unknown query parameters', async () => {
    const badCursor = await api()
      .get('/api/v1/items?cursor=not-a-cursor')
      .set('Authorization', ravi.bearer);
    const unknownParam = await api()
      .get('/api/v1/items?sort=hacked')
      .set('Authorization', ravi.bearer);

    expect(badCursor.status).toBe(400);
    expect(unknownParam.status).toBe(400);
  });

  it('lists my own items in every status', async () => {
    const mine = await reportAt(1, { title: 'My lost bag', type: 'LOST', category: 'BAG' });
    await setStatus(mine, 'RESOLVED');
    t.clock.set(minutesAfter(T0, 2));
    await report(ravi).expect(201);

    const res = await api().get('/api/v1/items/mine').set('Authorization', asha.bearer);

    expect(res.body.data.map((item: { id: string }) => item.id)).toEqual([mine]);
  });
});

describe('editing and removing', () => {
  it('lets the reporter edit an open item', async () => {
    const created = await report(asha);

    const res = await api()
      .patch(`/api/v1/items/${created.body.id}`)
      .set('Authorization', asha.bearer)
      .send({ title: 'Black iPhone 13', heldAtSecurityDesk: true });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ title: 'Black iPhone 13', heldAtSecurityDesk: true });
  });

  it('does not let others edit, or anyone edit once a claim is approved', async () => {
    const created = await report(asha);
    const byOther = await api()
      .patch(`/api/v1/items/${created.body.id}`)
      .set('Authorization', ravi.bearer)
      .send({ title: 'Mine now' });
    await setStatus(created.body.id, 'RESERVED');
    const reserved = await api()
      .patch(`/api/v1/items/${created.body.id}`)
      .set('Authorization', asha.bearer)
      .send({ title: 'Changed' });

    expect(byOther.status).toBe(403);
    expect(reserved.status).toBe(409);
    expect(reserved.body.error.code).toBe('INVALID_STATE_TRANSITION');
  });

  it('removes an item from view but keeps it for moderation', async () => {
    const created = await report(asha);

    const removed = await api()
      .delete(`/api/v1/items/${created.body.id}`)
      .set('Authorization', asha.bearer);
    const get = await api()
      .get(`/api/v1/items/${created.body.id}`)
      .set('Authorization', asha.bearer);
    const list = await api().get('/api/v1/items').set('Authorization', asha.bearer);

    expect(removed.status).toBe(204);
    expect(get.status).toBe(404);
    expect(list.body.data).toEqual([]);
    expect(t.storage.stored.size).toBe(1);
  });

  it('lets admins remove any item, but not other students', async () => {
    const created = await report(asha);
    const admin = await withRole(t, ravi, 'UNIVERSITY_ADMIN');
    const student = await signUp(t, 'kabir@rishihood.edu.in');

    const byStudent = await api()
      .delete(`/api/v1/items/${created.body.id}`)
      .set('Authorization', student.bearer);
    const byAdmin = await api()
      .delete(`/api/v1/items/${created.body.id}`)
      .set('Authorization', admin.bearer);

    expect(byStudent.status).toBe(403);
    expect(byAdmin.status).toBe(204);
  });
});

describe('profile picture', () => {
  const upload = (user: SignedInUser, file: Buffer, name = 'me.png') =>
    api()
      .put('/api/v1/users/me/avatar')
      .set('Authorization', user.bearer)
      .attach('avatar', file, name);

  it('uploads, replaces (deleting the old file) and removes the picture', async () => {
    const first = await upload(asha, fakePng());
    const second = await upload(asha, fakeJpeg());
    const removed = await api().delete('/api/v1/users/me/avatar').set('Authorization', asha.bearer);

    expect(first.status).toBe(200);
    expect(first.body.avatarUrl).toMatch(/^https:\/\/images\.test\/avatars\//);
    expect(second.body.avatarUrl).not.toBe(first.body.avatarUrl);
    expect(removed.body.avatarUrl).toBeNull();
    expect(t.storage.deleted).toHaveLength(2);
    expect(t.storage.stored.size).toBe(0);
  });

  it('shows the picture on the person’s items', async () => {
    const avatar = await upload(asha, fakePng());
    const created = await report(asha);

    const res = await api()
      .get(`/api/v1/items/${created.body.id}`)
      .set('Authorization', ravi.bearer);

    expect(res.body.reporter.avatarUrl).toBe(avatar.body.avatarUrl);
  });

  it('rejects missing, fake and oversized pictures', async () => {
    const missing = await api().put('/api/v1/users/me/avatar').set('Authorization', asha.bearer);
    const fake = await upload(asha, Buffer.from('not an image'));
    const tooBig = await upload(asha, fakePng(2 * 1024 * 1024));

    expect(missing.status).toBe(400);
    expect(fake.status).toBe(400);
    expect(tooBig.status).toBe(413);
  });
});
