import request from 'supertest';
import { Types } from 'mongoose';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  TEST_PASSWORD,
  fakeJpeg,
  reportItem,
  signUp,
  withRole,
  type SignedInUser,
} from '../../testing/signedIn';
import { minutesAfter } from '../../testing/builders';
import { seedUniversity, useTestApp } from '../../testing/testApp';
import { MongoUserRepository } from '../users/infrastructure/MongoUserRepository';

const t = useTestApp();
const api = () => request(t.app);

/** Asha is leaving; Ravi and Kabir stay; Meera works at the security desk. */
let asha: SignedInUser;
let ravi: SignedInUser;
let kabir: SignedInUser;
let meera: SignedInUser;

beforeEach(async () => {
  await seedUniversity(t.connection);
  asha = await signUp(t, 'asha@rishihood.edu.in', { firstName: 'Asha', lastName: 'Verma' });
  ravi = await signUp(t, 'ravi@rishihood.edu.in', { firstName: 'Ravi', lastName: 'Singh' });
  kabir = await signUp(t, 'kabir@rishihood.edu.in', { firstName: 'Kabir', lastName: 'Rao' });
  meera = await withRole(t, await signUp(t, 'meera@rishihood.edu.in'), 'SECURITY_DESK');
});

const get = (user: SignedInUser, path: string) =>
  api().get(`/api/v1/${path}`).set('Authorization', user.bearer);
const post = (user: SignedInUser, path: string, body: object = {}) =>
  api().post(`/api/v1/${path}`).set('Authorization', user.bearer).send(body);
const deleteAccount = (user: SignedInUser, password = TEST_PASSWORD) =>
  api().delete('/api/v1/account').set('Authorization', user.bearer).send({ password });

async function claimOn(itemId: string, claimant: SignedInUser): Promise<string> {
  const res = await post(claimant, `items/${itemId}/claims`, { message: 'It is mine!' });
  expect(res.status).toBe(201);
  return res.body.id as string;
}

const count = (model: string, filter: object) =>
  t.connection.models[model]!.countDocuments(filter).exec();

describe('deleting my account', () => {
  it('removes the person and their open posts, and keeps finished handovers anonymous', async () => {
    // A handover Asha finished: it stays in Ravi's history.
    const returned = await reportItem(t, asha, { title: 'Blue bottle' });
    const finished = await claimOn(returned, ravi);
    await post(asha, `claims/${finished}/approve`).expect(200);
    await post(meera, `claims/${finished}/handover/staff`).expect(200);
    // An open post of hers that Kabir has claimed.
    const open = await reportItem(t, asha, { title: 'Grey hoodie' });
    const kabirsClaim = await claimOn(open, kabir);
    // Her approved claim on Kabir's post.
    const kabirsPost = await reportItem(t, kabir, { title: 'Black umbrella' });
    const ashasClaim = await claimOn(kabirsPost, asha);
    await post(kabir, `claims/${ashasClaim}/approve`).expect(200);
    // A profile picture and a few notifications.
    await api()
      .put('/api/v1/users/me/avatar')
      .set('Authorization', asha.bearer)
      .attach('avatar', fakeJpeg(), 'me.jpg')
      .expect(200);
    await t.container.worker.drain();
    const ashaId = new Types.ObjectId(asha.id);
    expect(await count('Notification', { userId: ashaId })).toBeGreaterThan(0);
    const files = t.storage.stored.size;
    t.email.clear();

    const res = await deleteAccount(asha);
    await t.container.worker.drain();

    expect(res.status).toBe(204);
    // She is gone, with her sessions, notifications and picture.
    expect(await new MongoUserRepository(t.connection).findById(asha.id)).toBeNull();
    expect(await count('Session', { userId: ashaId })).toBe(0);
    expect(await count('Notification', { userId: ashaId })).toBe(0);
    expect(t.storage.stored.size).toBe(files - 1);
    const login = await api()
      .post('/api/v1/auth/login')
      .send({ email: asha.email, password: TEST_PASSWORD });
    expect(login.status).toBe(401);
    // Her open post is removed and Kabir's claim on it closed.
    expect((await get(kabir, `items/${open}`)).status).toBe(404);
    expect((await get(kabir, `claims/${kabirsClaim}`)).body.status).toBe('CANCELLED');
    // Her claim is withdrawn, so Kabir's umbrella can be claimed again.
    expect((await get(kabir, `claims/${ashasClaim}`)).body).toMatchObject({
      status: 'CANCELLED',
      claimant: { name: 'Former member', avatarUrl: null },
    });
    expect((await get(kabir, `items/${kabirsPost}`)).body.status).toBe('OPEN');
    // The finished handover stays, without her name.
    expect((await get(ravi, `items/${returned}`)).body).toMatchObject({
      status: 'RESOLVED',
      reporter: { name: 'Former member' },
    });
    expect((await get(ravi, `claims/${finished}`)).body).toMatchObject({
      status: 'COMPLETED',
      reporter: { name: 'Former member' },
    });
    // She gets a goodbye email, and the activity log records the deletion.
    expect(t.email.to(asha.email).map((m) => m.subject)).toEqual(['Your account was deleted']);
    expect(await count('AuditLog', { action: 'ACCOUNT_DELETED', targetId: ashaId })).toBe(1);
  });

  it('lets the same email sign up again afterwards', async () => {
    await deleteAccount(asha).expect(204);
    t.clock.set(minutesAfter(t.clock.now(), 2)); // past the wait between sign-up codes

    const again = await signUp(t, asha.email, { firstName: 'Asha' });

    expect(again.id).not.toBe(asha.id);
  });

  it('needs the password, and counts wrong ones like failed sign-ins', async () => {
    const res = await deleteAccount(asha, 'not-my-password-1');

    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual([
      { path: 'body.password', message: 'Your password is incorrect' },
    ]);
    expect((await get(asha, 'users/me')).status).toBe(200);
  });

  it('requires a signed-in user', async () => {
    const res = await api().delete('/api/v1/account').send({ password: TEST_PASSWORD });
    expect(res.status).toBe(401);
  });
});

describe('downloading my data', () => {
  it('gives everything the account holds as a JSON file, without secrets', async () => {
    const kept = await reportItem(t, asha, { title: 'Blue bottle' });
    const removed = await reportItem(t, asha, { title: 'Grey hoodie' });
    await api().delete(`/api/v1/items/${removed}`).set('Authorization', asha.bearer).expect(204);
    const received = await claimOn(kept, ravi);
    const made = await claimOn(await reportItem(t, kabir, { title: 'Umbrella' }), asha);
    await t.container.worker.drain();

    const res = await get(asha, 'account/export');

    expect(res.status).toBe(200);
    expect(res.headers['content-disposition']).toMatch(
      /^attachment; filename="?lost-and-found-data-\d{4}-\d{2}-\d{2}\.json"?$/,
    );
    expect(res.body).toMatchObject({
      account: { email: asha.email, firstName: 'Asha', enrollmentNumber: 'NST23001' },
      claimsMade: [{ id: made, item: { title: 'Umbrella' } }],
      claimsReceived: [{ id: received, claimant: { name: 'Ravi Singh' } }],
    });
    expect(res.body.posts.map((p: { id: string; status: string }) => [p.id, p.status])).toEqual([
      [removed, 'REMOVED'],
      [kept, 'OPEN'],
    ]);
    expect(res.body.notifications).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: 'CLAIM_RECEIVED' })]),
    );
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|\$2[aby]\$/);
  });

  it('requires a signed-in user', async () => {
    expect((await api().get('/api/v1/account/export')).status).toBe(401);
  });
});
