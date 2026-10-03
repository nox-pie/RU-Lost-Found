import { DEMO_PERSONAS } from '@ru-lost-found/shared';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { T0 } from '../../testing/builders';
import { fakeJpeg, reportItem, signUp, type SignedInUser } from '../../testing/signedIn';
import { seedUniversity, useTestApp } from '../../testing/testApp';
import { DEMO_PEOPLE } from './demoData';

const t = useTestApp({ env: { DEMO_MODE: 'true' } });
const api = () => request(t.app);

beforeEach(async () => {
  await seedUniversity(t.connection);
});

async function signInAs(persona: string) {
  return api().post('/api/v1/auth/demo').send({ persona });
}

async function asDemo(persona: string): Promise<SignedInUser> {
  const res = await signInAs(persona);
  expect(res.status).toBe(200);
  const token = res.body.accessToken as string;
  return { id: res.body.user.id, email: res.body.user.email, token, bearer: `Bearer ${token}` };
}

async function samplePost(user: SignedInUser, title: string): Promise<string> {
  const res = await api()
    .get('/api/v1/items?limit=50')
    .set('Authorization', user.bearer)
    .expect(200);
  const post = (res.body.data as { id: string; title: string }[]).find((p) => p.title === title);
  if (!post) throw new Error(`No sample post "${title}"`);
  return post.id;
}

describe('one-click demo sign-in', { timeout: 30_000 }, () => {
  it('is offered when the API runs in demo mode', async () => {
    const res = await api().get('/api/v1/auth/demo').expect(200);

    expect(res.body).toEqual({ enabled: true });
  });

  it('signs a visitor in as a sample person, with a refresh cookie like a normal sign-in', async () => {
    await t.container.services.demo.seed(T0);

    const res = await signInAs('asha.verma');

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ firstName: 'Asha', lastName: 'Verma', isDemo: true });
    expect(String(res.headers['set-cookie'])).toContain('rlf_refresh=');
    await api()
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${res.body.accessToken}`)
      .expect(200);
  });

  it('offers only the listed sample people, all of whom exist in the sample data', async () => {
    await t.container.services.demo.seed(T0);

    for (const persona of DEMO_PERSONAS) {
      expect(DEMO_PEOPLE.map((p) => p.key)).toContain(persona.key);
      expect((await signInAs(persona.key)).status).toBe(200);
    }
    expect((await signInAs('kabir.rao')).status).toBe(400);
    expect((await signInAs('owner@rishihood.edu.in')).status).toBe(400);
  });

  it('asks the visitor to wait while the sample data is being recreated', async () => {
    const res = await signInAs('asha.verma');

    expect(res.status).toBe(503);
    expect(res.body.error.message).toMatch(/being reset/);
  });

  it('refuses requests started by other sites', async () => {
    await t.container.services.demo.seed(T0);

    await api()
      .post('/api/v1/auth/demo')
      .set('Origin', 'https://evil.example')
      .send({ persona: 'asha.verma' })
      .expect(403);
  });

  it('is rate limited per visitor', async () => {
    await t.container.services.demo.seed(T0);

    for (let i = 0; i < 30; i += 1) expect((await signInAs('ravi.singh')).status).toBe(200);
    expect((await signInAs('ravi.singh')).status).toBe(429);
  });
});

describe('demo accounts', { timeout: 30_000 }, () => {
  let asha: SignedInUser;

  beforeEach(async () => {
    await t.container.services.demo.seed(T0);
    asha = await asDemo('asha.verma');
  });

  it('keep their sample profile and picture', async () => {
    await api()
      .patch('/api/v1/users/me')
      .set('Authorization', asha.bearer)
      .send({ firstName: 'Someone' })
      .expect(403);
    await api()
      .put('/api/v1/users/me/avatar')
      .set('Authorization', asha.bearer)
      .attach('avatar', fakeJpeg(), 'me.jpg')
      .expect(403);

    expect(t.storage.stored.size).toBe(0);
  });

  it('cannot edit or remove the sample posts everyone else relies on', async () => {
    const wallet = await samplePost(asha, 'Black bifold wallet');

    await api()
      .patch(`/api/v1/items/${wallet}`)
      .set('Authorization', asha.bearer)
      .send({ title: 'Something else' })
      .expect(403);
    await api().delete(`/api/v1/items/${wallet}`).set('Authorization', asha.bearer).expect(403);
    expect(await samplePost(asha, 'Black bifold wallet')).toBe(wallet); // still listed
  });

  it('cannot post new items or upload photos', async () => {
    const res = await api()
      .post('/api/v1/items')
      .set('Authorization', asha.bearer)
      .field('type', 'FOUND')
      .field('category', 'ELECTRONICS')
      .field('title', 'Black phone')
      .field('description', 'Found near the library entrance.')
      .field('location', 'Library')
      .field('occurredOn', '2026-10-01')
      .attach('photos', fakeJpeg(), 'photo.jpg');

    expect(res.status).toBe(403);
    expect(res.body.error.message).toMatch(/Demo accounts/);
    expect(t.storage.stored.size).toBe(0);
  });

  it('can flag sample posts but not real ones', async () => {
    const student: SignedInUser = await signUp(t, 'student@rishihood.edu.in');
    const realPost = await reportItem(t, student, { title: 'Real black phone' });
    const sample = await samplePost(asha, 'Red umbrella');
    const flag = (itemId: string) =>
      api()
        .post(`/api/v1/items/${itemId}/reports`)
        .set('Authorization', asha.bearer)
        .send({ reason: 'SPAM' });

    expect((await flag(realPost)).status).toBe(403);
    expect((await flag(sample)).status).toBe(201);
  });
});
