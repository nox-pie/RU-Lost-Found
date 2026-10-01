import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { WRITE_RATE_LIMIT } from './core/http/middleware/security';
import { minutesAfter } from './testing/builders';
import { TEST_PASSWORD, reportItem, signUp, withRole, type SignedInUser } from './testing/signedIn';
import { seedUniversity, useTestApp } from './testing/testApp';

const t = useTestApp();
const api = () => request(t.app);
const audit = () => t.container.services.audit;

let asha: SignedInUser;
let ravi: SignedInUser;

beforeEach(async () => {
  await seedUniversity(t.connection);
  asha = await signUp(t, 'asha@rishihood.edu.in', { firstName: 'Asha' });
  ravi = await signUp(t, 'ravi@rishihood.edu.in', { firstName: 'Ravi' });
});

describe('HTTP hardening', () => {
  it('sends strict headers and forbids caching of API responses', async () => {
    const res = await api().get('/api/v1/users/me').set('Authorization', asha.bearer);

    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.headers['content-security-policy']).toBe(
      "default-src 'none';frame-ancestors 'none'",
    );
    expect(res.headers['cross-origin-resource-policy']).toBe('same-site');
    expect(res.headers['referrer-policy']).toBe('no-referrer');
    expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
  });

  it('refuses cookie-authenticated requests coming from other websites', async () => {
    const login = await api()
      .post('/api/v1/auth/login')
      .send({ email: asha.email, password: TEST_PASSWORD });
    const cookie = ([] as string[]).concat(login.headers['set-cookie'] ?? [])[0]!.split(';')[0]!;

    const fromEvilSite = await api()
      .post('/api/v1/auth/refresh')
      .set('Cookie', cookie)
      .set('Origin', 'https://evil.example');
    const fromOurApp = await api()
      .post('/api/v1/auth/refresh')
      .set('Cookie', cookie)
      .set('Origin', 'http://localhost:5173');

    expect(fromEvilSite.status).toBe(403);
    expect(fromOurApp.status).toBe(200);
  });

  it('caps write requests per client, but not reads', async () => {
    for (let i = 0; i < WRITE_RATE_LIMIT.limit; i++) {
      await api().post('/api/v1/auth/logout');
    }

    const write = await api().post('/api/v1/auth/logout');
    const read = await api().get('/api/v1/users/me').set('Authorization', asha.bearer);

    expect(write.status).toBe(429);
    expect(read.status).toBe(200);
  });

  it('rejects NoSQL operators smuggled into request fields', async () => {
    const login = await api()
      .post('/api/v1/auth/login')
      .send({ email: { $ne: null }, password: { $ne: null } });
    const search = await api()
      .get('/api/v1/items?type[$ne]=LOST&q[$regex]=.*')
      .set('Authorization', asha.bearer);

    expect(login.status).toBe(400);
    expect(search.status).toBe(400);
  });
});

describe('audit log', () => {
  it('records logins, including failures with the reason and address', async () => {
    await api().post('/api/v1/auth/login').send({ email: asha.email, password: 'wrong-pass-1' });
    await api()
      .post('/api/v1/auth/login')
      .send({ email: 'nobody@rishihood.edu.in', password: 'wrong-pass-1' });
    await api().post('/api/v1/auth/login').send({ email: asha.email, password: TEST_PASSWORD });

    const entries = await audit().findRecent({});

    expect(entries.slice(0, 3).map((e) => [e.action, e.metadata.reason ?? null])).toEqual([
      ['LOGIN_SUCCEEDED', null],
      ['LOGIN_FAILED', 'UNKNOWN_EMAIL'],
      ['LOGIN_FAILED', 'WRONG_PASSWORD'],
    ]);
    expect(entries[0]?.actorId).toBe(asha.id);
    expect(JSON.stringify(entries)).not.toContain('wrong-pass-1');
  });

  it('records who did what to a claim, including staff overrides and lock-outs', async () => {
    const itemId = await reportItem(t, asha, { questions: 'What is the wallpaper?' });
    const claim = await api()
      .post(`/api/v1/items/${itemId}/claims`)
      .set('Authorization', ravi.bearer)
      .send({ answers: [{ questionId: 'q1', answer: 'Mountains' }] })
      .expect(201);
    const claimId = claim.body.id as string;
    await api()
      .post(`/api/v1/claims/${claimId}/approve`)
      .set('Authorization', asha.bearer)
      .expect(200);
    for (let i = 0; i < 5; i++) {
      await api()
        .post(`/api/v1/claims/${claimId}/handover`)
        .set('Authorization', asha.bearer)
        .send({ code: '999999' });
    }
    const staff = await withRole(t, await signUp(t, 'desk@rishihood.edu.in'), 'SECURITY_DESK');
    await api()
      .post(`/api/v1/claims/${claimId}/handover/staff`)
      .set('Authorization', staff.bearer)
      .expect(200);
    await t.container.worker.drain();

    const trail = await audit().findRecent({ targetId: claimId });

    // The test clock doesn't move, so entries share a timestamp: compare without order.
    expect(trail.map((e) => [e.action, e.actorId])).toEqual(
      expect.arrayContaining([
        ['CLAIM_SUBMITTED', ravi.id],
        ['CLAIM_APPROVED', asha.id],
        ['HANDOVER_LOCKED', asha.id],
        ['HANDOVER_CONFIRMED_BY_STAFF', staff.id],
      ]),
    );
    expect(trail).toHaveLength(4);
    expect(JSON.stringify(trail)).not.toMatch(/"code"/);
  });

  it('records a detected refresh-token theft', async () => {
    const login = await api()
      .post('/api/v1/auth/login')
      .send({ email: ravi.email, password: TEST_PASSWORD });
    const stolen = ([] as string[]).concat(login.headers['set-cookie'] ?? [])[0]!.split(';')[0]!;
    await api().post('/api/v1/auth/refresh').set('Cookie', stolen).expect(200);
    t.clock.set(minutesAfter(t.clock.now(), 5));

    await api().post('/api/v1/auth/refresh').set('Cookie', stolen).expect(401);

    const [entry] = await audit().findRecent({ action: 'SESSION_REUSE_DETECTED' });
    expect(entry?.metadata).toMatchObject({ userId: ravi.id, sessionsEnded: 1 });
  });

  it('records each event once, even if it is delivered again', async () => {
    await reportItem(t, asha);
    await t.container.worker.drain();
    await t.connection
      .collection('outbox_events')
      .updateMany({}, { $set: { status: 'PENDING', completedHandlers: [] } });

    await t.container.worker.drain();

    expect(await audit().findRecent({ action: 'ITEM_REPORTED' })).toHaveLength(1);
  });
});
