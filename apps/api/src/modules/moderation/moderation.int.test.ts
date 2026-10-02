import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { MongoItemRepository } from '../items/infrastructure/MongoItemRepository';
import { reportItem, signUp, withRole, type SignedInUser } from '../../testing/signedIn';
import { seedUniversity, useTestApp } from '../../testing/testApp';

const t = useTestApp();
const api = () => request(t.app);
const drain = () => t.container.worker.drain();

/** Asha posts; Ravi and Kabir are other students; Priya is the university admin. */
let asha: SignedInUser;
let ravi: SignedInUser;
let kabir: SignedInUser;
let priya: SignedInUser;

beforeEach(async () => {
  await seedUniversity(t.connection);
  asha = await signUp(t, 'asha@rishihood.edu.in', { firstName: 'Asha', lastName: 'Verma' });
  ravi = await signUp(t, 'ravi@rishihood.edu.in', { firstName: 'Ravi', lastName: 'Singh' });
  kabir = await signUp(t, 'kabir@rishihood.edu.in', { firstName: 'Kabir', lastName: 'Rao' });
  priya = await withRole(
    t,
    await signUp(t, 'priya@rishihood.edu.in', { firstName: 'Priya', lastName: 'Nair' }),
    'UNIVERSITY_ADMIN',
  );
});

const flag = (user: SignedInUser, itemId: string, body: object = { reason: 'SPAM' }) =>
  api().post(`/api/v1/items/${itemId}/reports`).set('Authorization', user.bearer).send(body);

const queue = (status = 'OPEN') =>
  api().get(`/api/v1/admin/reports?status=${status}`).set('Authorization', priya.bearer);

const decide = (itemId: string, body: object, user = priya) =>
  api()
    .post(`/api/v1/admin/items/${itemId}/moderation`)
    .set('Authorization', user.bearer)
    .send(body);

describe('flagging a post', () => {
  it('puts it in the admins’ review queue', async () => {
    const item = await reportItem(t, asha, { title: 'iPhone for sale, cheap' });

    const res = await flag(ravi, item, { reason: 'SCAM', details: 'This is an advert' });

    expect(res.status).toBe(201);
    const open = await queue().expect(200);
    expect(open.body.data).toMatchObject([
      {
        reason: 'SCAM',
        details: 'This is an advert',
        status: 'OPEN',
        flaggedBy: { id: ravi.id, name: 'Ravi Singh' },
        item: { id: item, title: 'iPhone for sale, cheap', reporter: { id: asha.id } },
        resolution: null,
      },
    ]);
  });

  it('accepts one report per person per post', async () => {
    const item = await reportItem(t, asha);
    await flag(ravi, item).expect(201);

    const again = await flag(ravi, item);

    expect(again.status).toBe(409);
    expect(again.body.error.message).toMatch(/already reported/);
    expect((await flag(kabir, item)).status).toBe(201);
  });

  it('refuses reports on your own post, on removed posts and without a reason', async () => {
    const item = await reportItem(t, asha);

    expect((await flag(asha, item)).status).toBe(403);
    expect((await flag(ravi, item, { reason: 'OTHER' })).status).toBe(400);
    expect((await flag(ravi, item, { reason: 'NOT_A_REASON' })).status).toBe(400);

    await api().delete(`/api/v1/items/${item}`).set('Authorization', asha.bearer).expect(204);
    expect((await flag(ravi, item)).status).toBe(404);
  });

  it('is limited per person per day', async () => {
    const items = [];
    for (let i = 0; i < 21; i++) items.push(await reportItem(t, i % 2 ? asha : kabir));
    const results = [];
    for (const item of items) results.push((await flag(ravi, item)).status);

    expect(results.slice(0, 20).every((status) => status === 201)).toBe(true);
    expect(results[20]).toBe(429);
  });
});

describe('deciding on reports', () => {
  it('removes the post: closes every report on it and its claims, and tells the reporter', async () => {
    const item = await reportItem(t, asha, { title: 'Fake listing' });
    await flag(ravi, item).expect(201);
    await flag(kabir, item, { reason: 'SCAM' }).expect(201);
    await api()
      .post(`/api/v1/items/${item}/claims`)
      .set('Authorization', kabir.bearer)
      .send({ message: 'Mine' })
      .expect(201);

    const res = await decide(item, { decision: 'REMOVE_ITEM', note: 'Not a lost item' });
    await drain();

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ resolved: 2 });
    expect((await queue().expect(200)).body.data).toEqual([]);
    const decided = await queue('RESOLVED').expect(200);
    expect(decided.body.data).toHaveLength(2);
    expect(decided.body.data[0]).toMatchObject({
      status: 'ACTIONED',
      resolution: { by: { id: priya.id }, note: 'Not a lost item' },
    });

    expect(
      (await api().get(`/api/v1/items/${item}`).set('Authorization', ravi.bearer)).status,
    ).toBe(404);
    const kabirsClaims = await api()
      .get('/api/v1/claims/mine')
      .set('Authorization', kabir.bearer)
      .expect(200);
    expect(kabirsClaims.body.data[0].status).toBe('CANCELLED');

    const notifications = await api()
      .get('/api/v1/notifications')
      .set('Authorization', asha.bearer)
      .expect(200);
    expect(notifications.body.data[0]).toMatchObject({
      type: 'ITEM_REMOVED_BY_MODERATOR',
      body: expect.stringContaining('Reason: Not a lost item'),
    });
    expect(t.email.to(asha.email).at(-1)?.subject).toBe('Your post was removed');
  });

  it('dismisses the reports and keeps the post', async () => {
    const item = await reportItem(t, asha);
    await flag(ravi, item).expect(201);

    await decide(item, { decision: 'DISMISS' }).expect(200);

    expect(
      (await api().get(`/api/v1/items/${item}`).set('Authorization', ravi.bearer)).status,
    ).toBe(200);
    expect((await queue('RESOLVED').expect(200)).body.data[0].status).toBe('DISMISSED');
    expect((await decide(item, { decision: 'DISMISS' })).status).toBe(404);
  });

  it('records flags and decisions in the activity log', async () => {
    const item = await reportItem(t, asha);
    await flag(ravi, item).expect(201);
    await decide(item, { decision: 'REMOVE_ITEM' }).expect(200);
    await drain();

    const log = await api()
      .get('/api/v1/admin/audit')
      .set('Authorization', priya.bearer)
      .expect(200);
    const actions = log.body.data.map((e: { action: string }) => e.action);
    expect(actions.slice(0, 3)).toEqual(
      expect.arrayContaining(['ITEM_FLAGGED', 'REPORT_RESOLVED', 'ITEM_REMOVED']),
    );
    expect(
      log.body.data.find((e: { action: string }) => e.action === 'ITEM_REMOVED'),
    ).toMatchObject({ actor: { id: priya.id }, metadata: { byModerator: true } });
  });

  it('is only for admins', async () => {
    const item = await reportItem(t, asha);
    await flag(ravi, item).expect(201);

    expect((await decide(item, { decision: 'REMOVE_ITEM' }, kabir)).status).toBe(403);
    expect(
      (await api().get('/api/v1/admin/reports').set('Authorization', kabir.bearer)).status,
    ).toBe(403);
  });

  it('counts open reports in the statistics', async () => {
    const item = await reportItem(t, asha);
    await flag(ravi, item).expect(201);

    const stats = await api()
      .get('/api/v1/admin/stats')
      .set('Authorization', priya.bearer)
      .expect(200);

    expect(stats.body.moderation.openReports).toBe(1);
  });
});

describe('removing a post directly', () => {
  const remove = (itemId: string, body: object = {}, user = priya) =>
    api().post(`/api/v1/admin/items/${itemId}/remove`).set('Authorization', user.bearer).send(body);

  it('removes it with a reason, closes its open reports and tells the poster', async () => {
    const item = await reportItem(t, asha, { title: 'Phones for sale' });
    await flag(ravi, item).expect(201);

    const res = await remove(item, { reason: 'Selling is not allowed' });
    await drain();

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ resolvedReports: 1 });
    expect((await queue().expect(200)).body.data).toEqual([]);
    const notifications = await api()
      .get('/api/v1/notifications')
      .set('Authorization', asha.bearer)
      .expect(200);
    expect(notifications.body.data[0]).toMatchObject({
      type: 'ITEM_REMOVED_BY_MODERATOR',
      body: expect.stringContaining('Reason: Selling is not allowed'),
    });
    expect((await remove(item)).status).toBe(409);
  });

  it('works for an admin’s own post, even after it was handed over', async () => {
    const item = await reportItem(t, priya, { title: 'Test post' });
    const items = new MongoItemRepository(t.connection);
    const stored = await items.findById({ universityId: await priyasUniversity() }, item);
    stored!.reserve(t.clock.now());
    stored!.resolve(t.clock.now());
    await items.update(stored!);

    const res = await remove(item);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ resolvedReports: 0 });
  });

  it('is only for admins', async () => {
    const item = await reportItem(t, asha);

    expect((await remove(item, {}, kabir)).status).toBe(403);
  });
});

async function priyasUniversity(): Promise<string> {
  const me = await api().get('/api/v1/users/me').set('Authorization', priya.bearer).expect(200);
  return me.body.universityId as string;
}
