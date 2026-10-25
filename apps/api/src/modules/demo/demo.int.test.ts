import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { ForbiddenError } from '../../core/errors/AppError';
import { T0 } from '../../testing/builders';
import { MongoUserRepository } from '../users/infrastructure/MongoUserRepository';
import { reportItem, signUp, withRole, type SignedInUser } from '../../testing/signedIn';
import { seedUniversity, useTestApp } from '../../testing/testApp';
import seedFile from '../../../seed/universities.json';
import { DEMO_RESET_INTERVAL_SECONDS } from './DemoSeeder';
import { DEMO_PEOPLE, DEMO_POSTS, DEMO_REPORTS } from './demoData';

const t = useTestApp();
const api = () => request(t.app);
const demo = () => t.container.services.demo;

let visitor: SignedInUser;

beforeEach(async () => {
  await seedUniversity(t.connection);
  visitor = await signUp(t, 'visitor@rishihood.edu.in');
  t.email.clear();
});

async function feed(status = 'OPEN,RESERVED,RESOLVED') {
  const res = await api()
    .get(`/api/v1/items?status=${status}&limit=50`)
    .set('Authorization', visitor.bearer)
    .expect(200);
  return res.body.data as {
    id: string;
    title: string;
    status: string;
    isSample: boolean;
    place: string | null;
    location: string;
  }[];
}

// Each test seeds the sample people and posts through real claim flows: allow for a busy test run.
describe('sample data', { timeout: 30_000 }, () => {
  it('creates people and posts in every status through the real claim flow', async () => {
    const result = await demo().seed(T0);
    await t.container.worker.drain();

    expect(result).toEqual({ people: DEMO_PEOPLE.length, posts: DEMO_POSTS.length });
    const posts = await feed();
    expect(posts).toHaveLength(DEMO_POSTS.length);
    expect(posts.every((p) => p.isSample)).toBe(true);
    const count = (status: string) => posts.filter((p) => p.status === status).length;
    expect(count('RESERVED')).toBe(2);
    expect(count('RESOLVED')).toBe(3);
    expect(count('OPEN')).toBe(DEMO_POSTS.length - 5);
    // Demo people never get real emails (their addresses are on a reserved domain).
    expect(t.email.sent).toHaveLength(0);
  });

  it('names only campus places that Rishihood University really has', () => {
    const rishihood = seedFile.find((university) => university.slug === 'rishihood');

    const unknown = DEMO_POSTS.filter((post) => !rishihood?.places.includes(post.place));

    expect(unknown.map((post) => `${post.title}: ${post.place}`)).toEqual([]);
  });

  it('puts every sample post at its campus place, with the exact spot apart', async () => {
    const places = [...new Set(DEMO_POSTS.map((post) => post.place))];
    await t.connection
      .collection('universities')
      .updateOne({ slug: 'rishihood' }, { $set: { places } });

    await demo().seed(T0);

    const posts = await feed();
    const wallet = posts.find((p) => p.title === 'Black bifold wallet');
    expect(wallet).toMatchObject({ place: 'Library', location: 'Reading room' });
    expect(posts.every((p) => p.place !== null)).toBe(true);
  });

  it('keeps the place in the spot where a university lacks it', async () => {
    await demo().seed(T0); // the test university offers only Library, Canteen and Hostel

    const posts = await feed();
    expect(posts.find((p) => p.title === 'Black bifold wallet')).toMatchObject({
      place: 'Library',
      location: 'Reading room',
    });
    expect(posts.find((p) => p.title === 'White iPhone with a clear case')).toMatchObject({
      place: null,
      location: 'CCD, near the counter',
    });
  });

  it('keeps reserved posts reserved until the next reset', async () => {
    await demo().seed(T0);

    t.clock.set(new Date(T0.getTime() + DEMO_RESET_INTERVAL_SECONDS * 1000));
    const expired = await t.container.services.claims.expireOverdue();
    t.clock.set(T0); // back to when the visitor's access token is valid

    expect(expired).toBe(0);
    expect(await feed('RESERVED')).toHaveLength(2);
  });

  it('cannot be signed into unless the API runs in demo mode', async () => {
    await demo().seed(T0);

    expect((await api().get('/api/v1/auth/demo').expect(200)).body).toEqual({ enabled: false });
    await api().post('/api/v1/auth/demo').send({ persona: 'asha.verma' }).expect(404);
  });

  it('is created only once', async () => {
    await demo().seed(T0);

    expect(await demo().seed(T0)).toBeNull();
    expect(await feed()).toHaveLength(DEMO_POSTS.length);
  });

  it('gives existing demo accounts their sample pictures at start-up', async () => {
    await demo().seed(T0);
    await t.connection
      .collection('users')
      .updateMany({ email: /@demo\.invalid$/ }, { $set: { 'profile.avatar': null } });

    await demo().seed(T0); // what every start-up runs

    const asha = await t.connection
      .collection('users')
      .findOne({ email: 'asha.verma@demo.invalid' });
    expect(asha?.profile.avatar.url).toBe('/demo/people/asha.webp');
  });

  it('marks only sample posts as samples', async () => {
    await demo().seed(T0);
    const real = await reportItem(t, visitor, { title: 'Real black phone' });

    const posts = await feed();

    expect(posts.find((p) => p.id === real)?.isSample).toBe(false);
  });

  it('is removed completely, including what visitors did with it, without touching real data', async () => {
    await demo().seed(T0);
    const real = await reportItem(t, visitor, { title: 'Real black phone' });
    const sample = (await feed('OPEN')).find((p) => p.isSample && p.title === 'Red umbrella');
    await api()
      .post(`/api/v1/items/${sample!.id}/claims`)
      .set('Authorization', visitor.bearer)
      .send({ message: 'Mine!' })
      .expect(201);
    await t.container.worker.drain();

    const removed = await demo().remove();

    expect(removed.users).toBe(DEMO_PEOPLE.length);
    expect((await feed()).map((p) => p.id)).toEqual([real]);
    const claims = await api()
      .get('/api/v1/claims/mine')
      .set('Authorization', visitor.bearer)
      .expect(200);
    expect(claims.body.data).toEqual([]);
    const notifications = await api()
      .get('/api/v1/notifications')
      .set('Authorization', visitor.bearer)
      .expect(200);
    expect(notifications.body.data).toEqual([]);
  });

  it('never lets a demo account claim a real post', async () => {
    await demo().seed(T0);
    const real = await reportItem(t, visitor, { title: 'Real black phone' });
    const asha = await new MongoUserRepository(t.connection).findByEmail('asha.verma@demo.invalid');

    await expect(
      t.container.services.claims.submit(
        { userId: asha!.id, role: asha!.role },
        { universityId: asha!.universityId },
        real,
        { message: 'Mine', answers: [], sharePhone: false },
      ),
    ).rejects.toThrow(ForbiddenError);
  });

  it('gives the admins two reports to review and two already decided', async () => {
    await demo().seed(T0);
    const admin = await withRole(t, visitor, 'UNIVERSITY_ADMIN');
    const reports = async (status: 'OPEN' | 'RESOLVED') =>
      (
        await api()
          .get(`/api/v1/admin/reports?status=${status}`)
          .set('Authorization', admin.bearer)
          .expect(200)
      ).body.data as {
        status: string;
        item: { title: string; status: string };
        resolution: { by: { name: string } } | null;
      }[];

    const open = await reports('OPEN');
    const decided = await reports('RESOLVED');

    expect(open).toHaveLength(2);
    expect(open.every((r) => r.status === 'OPEN' && r.item.status === 'OPEN')).toBe(true);
    expect(decided.map((r) => r.status).sort()).toEqual(['ACTIONED', 'DISMISSED']);
    expect(decided.find((r) => r.status === 'ACTIONED')?.item.status).toBe('REMOVED');
    expect(decided.find((r) => r.status === 'DISMISSED')?.item.status).toBe('OPEN');
    expect(decided.every((r) => r.resolution?.by.name === 'Neha Sharma')).toBe(true);
    expect(DEMO_REPORTS).toHaveLength(4);
    // The removed post (an advert) never reaches the feed.
    expect(await feed()).toHaveLength(DEMO_POSTS.length);
  });

  it('has a sample admin nobody can sign in as', async () => {
    await demo().seed(T0);
    const neha = await new MongoUserRepository(t.connection).findByEmail(
      'neha.sharma@demo.invalid',
    );

    expect(neha?.role).toBe('UNIVERSITY_ADMIN');
    expect(() => neha?.changePassword('anything', T0)).toThrow(ForbiddenError);
  });

  it('resets to the original posts', async () => {
    await demo().seed(T0);
    const first = (await feed()).map((p) => p.id);

    await demo().reset(T0);

    const second = await feed();
    expect(second).toHaveLength(DEMO_POSTS.length);
    expect(second.some((p) => first.includes(p.id))).toBe(false);
  });
});
