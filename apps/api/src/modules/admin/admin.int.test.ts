import request, { type Response } from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { T0, daysAfter, minutesAfter } from '../../testing/builders';
import {
  TEST_PASSWORD,
  reportItem,
  signUp,
  withRole,
  type SignedInUser,
} from '../../testing/signedIn';
import { seedUniversity, useTestApp } from '../../testing/testApp';

const t = useTestApp();
const api = () => request(t.app);
const drain = () => t.container.worker.drain();

/** Priya is the university admin; Asha and Ravi are students; Meera is at the security desk. */
let priya: SignedInUser;
let asha: SignedInUser;
let ravi: SignedInUser;
let meera: SignedInUser;

beforeEach(async () => {
  await seedUniversity(t.connection);
  priya = await withRole(
    t,
    await signUp(t, 'priya@rishihood.edu.in', { firstName: 'Priya', lastName: 'Nair' }),
    'UNIVERSITY_ADMIN',
  );
  asha = await signUp(t, 'asha@rishihood.edu.in', { firstName: 'Asha', lastName: 'Verma' });
  ravi = await signUp(t, 'ravi@rishihood.edu.in', { firstName: 'Ravi', lastName: 'Singh' });
  meera = await withRole(
    t,
    await signUp(t, 'meera@rishihood.edu.in', { firstName: 'Meera', lastName: 'Iyer' }),
    'SECURITY_DESK',
  );
});

const get = (user: SignedInUser, path: string) =>
  api().get(`/api/v1/admin/${path}`).set('Authorization', user.bearer);
const post = (user: SignedInUser, path: string, body: object = {}) =>
  api().post(`/api/v1/admin/${path}`).set('Authorization', user.bearer).send(body);
const setRole = (user: SignedInUser, target: SignedInUser, role: string) =>
  api()
    .patch(`/api/v1/admin/users/${target.id}/role`)
    .set('Authorization', user.bearer)
    .send({ role });

function refreshCookie(res: Response): string {
  const cookie = ([] as string[])
    .concat(res.headers['set-cookie'] ?? [])
    .find((c) => c.startsWith('rlf_refresh='));
  if (!cookie) throw new Error('No refresh cookie was set');
  return cookie.split(';')[0] as string;
}

const signIn = (email: string) =>
  api().post('/api/v1/auth/login').send({ email, password: TEST_PASSWORD });

async function freshBearer(user: SignedInUser): Promise<string> {
  const res = await signIn(user.email).expect(200);
  return `Bearer ${res.body.accessToken as string}`;
}

describe('admin access', () => {
  it('is only for university admins', async () => {
    for (const user of [asha, meera]) {
      expect((await get(user, 'stats')).status).toBe(403);
      expect((await get(user, 'users')).status).toBe(403);
    }
    expect((await api().get('/api/v1/admin/stats')).status).toBe(401);
    expect((await get(priya, 'stats')).status).toBe(200);
  });

  it('ends at once when an admin is demoted, without waiting for the token to expire', async () => {
    const kiran = await withRole(t, await signUp(t, 'kiran@rishihood.edu.in'), 'PLATFORM_ADMIN');
    await setRole(kiran, priya, 'STUDENT').expect(200);

    // Priya's access token still says UNIVERSITY_ADMIN, but the stored role is checked.
    expect((await get(priya, 'stats')).status).toBe(403);
  });
});

describe('managing users', () => {
  it('lists and searches the university’s users, newest first', async () => {
    const all = await get(priya, 'users').expect(200);
    expect(all.body.data.map((u: { email: string }) => u.email)).toEqual([
      'meera@rishihood.edu.in',
      'ravi@rishihood.edu.in',
      'asha@rishihood.edu.in',
      'priya@rishihood.edu.in',
    ]);
    expect(all.body.data[0]).toMatchObject({ role: 'SECURITY_DESK', status: 'ACTIVE' });
    expect(all.body.data[0]).not.toHaveProperty('passwordHash');

    const byName = await get(priya, 'users?q=asha%20ver').expect(200);
    expect(byName.body.data.map((u: { id: string }) => u.id)).toEqual([asha.id]);

    const byRole = await get(priya, 'users?role=SECURITY_DESK').expect(200);
    expect(byRole.body.data.map((u: { id: string }) => u.id)).toEqual([meera.id]);

    // Regex characters are matched literally, not interpreted.
    expect((await get(priya, 'users?q=.*').expect(200)).body.data).toEqual([]);
  });

  it('pages through users with a cursor', async () => {
    const first = await get(priya, 'users?limit=3').expect(200);
    const second = await get(priya, `users?limit=3&cursor=${first.body.nextCursor}`).expect(200);

    expect(first.body.data).toHaveLength(3);
    expect(second.body.data.map((u: { id: string }) => u.id)).toEqual([priya.id]);
    expect(second.body.nextCursor).toBeNull();
  });

  it('changes roles within the admin’s own rank, and records it', async () => {
    const res = await setRole(priya, asha, 'SECURITY_DESK');

    expect(res.status).toBe(200);
    expect(res.body.role).toBe('SECURITY_DESK');
    expect((await setRole(priya, ravi, 'PLATFORM_ADMIN')).status).toBe(403);

    await drain();
    const log = await get(priya, `audit?action=USER_ROLE_CHANGED&targetId=${asha.id}`).expect(200);
    expect(log.body.data).toMatchObject([
      {
        actor: { id: priya.id, name: 'Priya Nair' },
        targetType: 'USER',
        metadata: { from: 'STUDENT', to: 'SECURITY_DESK' },
      },
    ]);
  });

  it('never lets admins change themselves or each other', async () => {
    const other = await withRole(t, await signUp(t, 'dev@rishihood.edu.in'), 'UNIVERSITY_ADMIN');

    expect((await setRole(priya, priya, 'STUDENT')).status).toBe(403);
    expect((await setRole(priya, other, 'STUDENT')).status).toBe(403);
    expect((await post(priya, `users/${other.id}/suspend`, { reason: 'Testing' })).status).toBe(
      403,
    );
  });

  it('suspends a user: signs them out everywhere, blocks sign-in, and emails them', async () => {
    const session = refreshCookie(await signIn(ravi.email).expect(200));

    const res = await post(priya, `users/${ravi.id}/suspend`, { reason: 'Posting fake items' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('SUSPENDED');
    expect((await api().post('/api/v1/auth/refresh').set('Cookie', session)).status).toBe(401);
    expect((await signIn(ravi.email)).status).toBe(403);

    await drain();
    expect(t.email.to(ravi.email).at(-1)).toMatchObject({
      subject: 'Your account was suspended',
      text: expect.stringContaining('Reason: Posting fake items'),
    });
  });

  it('stops a suspended user at once, although their access token still works for minutes', async () => {
    const own = await reportItem(t, ravi, { title: 'Ravi’s umbrella' });
    const other = await reportItem(t, asha, { title: 'Asha’s keys', type: 'FOUND' });
    await post(priya, `users/${ravi.id}/suspend`, { reason: 'Posting fake items' }).expect(200);
    const asRavi = (method: 'post' | 'patch', path: string, body: object) =>
      api()[method](`/api/v1${path}`).set('Authorization', ravi.bearer).send(body);

    expect((await asRavi('patch', `/items/${own}`, { title: 'Changed' })).status).toBe(401);
    expect((await asRavi('post', `/items/${own}/close`, { reason: 'WITHDRAWN' })).status).toBe(401);
    expect((await asRavi('post', `/items/${other}/claims`, { message: 'Mine' })).status).toBe(401);
    expect((await asRavi('post', `/items/${other}/reports`, { reason: 'SPAM' })).status).toBe(401);
  });

  it('reactivates a suspended user', async () => {
    await post(priya, `users/${ravi.id}/suspend`, { reason: 'Posting fake items' }).expect(200);

    const res = await post(priya, `users/${ravi.id}/reactivate`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ACTIVE');
    expect((await signIn(ravi.email)).status).toBe(200);
    expect((await post(priya, `users/${ravi.id}/reactivate`)).status).toBe(409);
  });

  it('asks for a reason when suspending', async () => {
    const res = await post(priya, `users/${ravi.id}/suspend`, { reason: '' });

    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual([expect.objectContaining({ path: 'body.reason' })]);
  });

  it('cannot see or manage users of another university', async () => {
    await seedUniversity(t.connection, {
      name: 'Other University',
      slug: 'other',
      emailDomains: ['other.edu'],
    });
    const outsider = await signUp(t, 'zoe@other.edu');

    expect((await setRole(priya, outsider, 'SECURITY_DESK')).status).toBe(404);
    expect((await post(priya, `users/${outsider.id}/suspend`, { reason: 'Not ours' })).status).toBe(
      404,
    );
    const listed = await get(priya, 'users?q=zoe').expect(200);
    expect(listed.body.data).toEqual([]);
  });
});

describe('statistics', () => {
  it('counts users, items, claims and returns for the university', async () => {
    const phone = await reportItem(t, asha, { title: 'Black phone' });
    await reportItem(t, ravi, { type: 'LOST', title: 'Blue bottle', category: 'BOTTLE' });
    const claim = await api()
      .post(`/api/v1/items/${phone}/claims`)
      .set('Authorization', ravi.bearer)
      .send({ message: 'Mine' })
      .expect(201);
    await api()
      .post(`/api/v1/claims/${claim.body.id}/approve`)
      .set('Authorization', asha.bearer)
      .send({})
      .expect(200);
    const seen = await api()
      .get(`/api/v1/claims/${claim.body.id}`)
      .set('Authorization', ravi.bearer)
      .expect(200);
    // Two days later (access tokens last 15 minutes, so everyone signs in again).
    t.clock.set(daysAfter(t.clock.now(), 2));
    await api()
      .post(`/api/v1/claims/${claim.body.id}/handover`)
      .set('Authorization', await freshBearer(asha))
      .send({ code: seen.body.handover.code })
      .expect(200);

    const res = await api()
      .get('/api/v1/admin/stats')
      .set('Authorization', await freshBearer(priya))
      .expect(200);

    expect(res.body).toMatchObject({
      users: {
        total: 4,
        suspended: 0,
        byRole: { STUDENT: 2, SECURITY_DESK: 1, UNIVERSITY_ADMIN: 1, PLATFORM_ADMIN: 0 },
        joinedLast30Days: 4,
      },
      items: {
        byStatus: { OPEN: 1, RESERVED: 0, RESOLVED: 1, REMOVED: 0 },
        lost: 1,
        found: 1,
        reportedLast30Days: 2,
        returnedLast30Days: 1,
        recoveryRate: 0.5,
        averageDaysToReturn: 2,
      },
      claims: { byStatus: { COMPLETED: 1, REQUESTED: 0 } },
      moderation: { openReports: 0 },
    });
    expect(res.body.weekly).toHaveLength(8);
    const weeks = res.body.weekly as { reported: number; returned: number }[];
    expect(weeks.reduce((sum, week) => sum + week.reported, 0)).toBe(2);
    expect(weeks.reduce((sum, week) => sum + week.returned, 0)).toBe(1);
  });

  it('starts at zero for a new university', async () => {
    const res = await get(priya, 'stats').expect(200);

    expect(res.body.items).toMatchObject({ recoveryRate: null, averageDaysToReturn: null });
  });
});

describe('insights', () => {
  it('breaks the posts down by category and by campus place, removed ones aside', async () => {
    await reportItem(t, asha, { title: 'Black phone', place: 'Library' });
    await reportItem(t, ravi, { type: 'LOST', title: 'Grey phone', place: 'Library' });
    await reportItem(t, ravi, {
      type: 'LOST',
      category: 'BOTTLE',
      title: 'Bottle',
      place: 'Canteen',
    });
    await reportItem(t, asha, { category: 'KEYS', title: 'Keys' });
    const removed = await reportItem(t, asha, { category: 'KEYS', title: 'Spam', place: 'Hostel' });
    await api().delete(`/api/v1/items/${removed}`).set('Authorization', asha.bearer).expect(204);

    const { breakdown } = (await get(priya, 'stats').expect(200)).body;

    expect(breakdown.byCategory).toEqual([
      { category: 'ELECTRONICS', lost: 1, found: 1, returned: 0 },
      { category: 'BOTTLE', lost: 1, found: 0, returned: 0 },
      { category: 'KEYS', lost: 0, found: 1, returned: 0 },
    ]);
    expect(breakdown.byPlace).toEqual([
      { place: 'Library', lost: 1, found: 1, returned: 0 },
      { place: 'Canteen', lost: 1, found: 0, returned: 0 },
      { place: null, lost: 0, found: 1, returned: 0 },
    ]);
  });

  it('exports the posts of a period as a CSV file, without anyone’s personal details', async () => {
    await reportItem(t, asha, {
      title: 'Black phone',
      place: 'Library',
      location: 'Desk 4, near "B"',
    });
    await reportItem(t, ravi, { type: 'LOST', title: '=HYPERLINK("http://x.example")' });
    const from = new Date(t.clock.now().getTime() - 60_000).toISOString();
    const until = new Date(t.clock.now().getTime() + 60_000).toISOString();

    const res = await get(priya, `export/posts?from=${from}&until=${until}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/^text\/csv/);
    expect(res.headers['content-disposition']).toMatch(/^attachment; filename="?posts-.*\.csv"?$/);
    const lines = res.text.trim().split('\r\n');
    expect(lines[0]).toBe(
      'Posted on,Type,Category,Title,Campus place,Exact spot,Happened on,Status,Closed because,Returned on,Days to return,Held at the security desk',
    );
    expect(lines).toHaveLength(3);
    expect(lines[1]).toContain('FOUND,ELECTRONICS,Black phone,Library,"Desk 4, near ""B"""');
    // A title that looks like a formula is kept as text, so a spreadsheet won't run it.
    expect(lines[2]).toContain(`"'=HYPERLINK(""http://x.example"")"`);
    expect(res.text).not.toMatch(/asha|ravi|@rishihood/i);
  });

  it('is for admins only', async () => {
    expect((await get(meera, 'export/posts')).status).toBe(403);
  });
});

describe('activity log', () => {
  it('shows the university’s audit entries newest first, with who did what', async () => {
    await reportItem(t, asha, { title: 'Black phone' });
    await drain();

    const res = await get(priya, 'audit?limit=2').expect(200);

    expect(res.body.data[0]).toMatchObject({
      action: 'ITEM_REPORTED',
      actor: { id: asha.id, name: 'Asha Verma' },
      targetType: 'ITEM',
    });
    expect(res.body.nextCursor).toEqual(expect.any(String));
    const next = await get(priya, `audit?limit=50&cursor=${res.body.nextCursor}`).expect(200);
    expect(next.body.data.map((e: { action: string }) => e.action)).toContain('USER_REGISTERED');
  });

  it('shows a blocked session theft on the victim’s university', async () => {
    const login = await api()
      .post('/api/v1/auth/login')
      .send({ email: asha.email, password: TEST_PASSWORD })
      .expect(200);
    const stolenCookie = (login.headers['set-cookie'] as unknown as string[])[0]!.split(';')[0]!;
    await api().post('/api/v1/auth/refresh').set('Cookie', stolenCookie).expect(200); // rotated
    t.clock.set(minutesAfter(T0, 1)); // past the grace window for a lost answer
    await api().post('/api/v1/auth/refresh').set('Cookie', stolenCookie).expect(401); // replayed

    const res = await get(priya, 'audit?action=SESSION_REUSE_DETECTED').expect(200);

    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toMatchObject({
      action: 'SESSION_REUSE_DETECTED',
      metadata: { userId: asha.id },
    });
  });
});

describe('activity filters', () => {
  const activity = (query: string) => get(priya, `audit?${query}`);
  const iso = (date: Date) => encodeURIComponent(date.toISOString());

  it('shows only the entries in a time range (from inclusive, until exclusive)', async () => {
    await reportItem(t, asha, { title: 'Black phone' });
    await drain();
    const hourBefore = minutesAfter(T0, -60);
    const hourAfter = minutesAfter(T0, 60);

    const around = await activity(`from=${iso(hourBefore)}&until=${iso(hourAfter)}`).expect(200);
    const later = await activity(`from=${iso(hourAfter)}`).expect(200);
    const earlier = await activity(`until=${iso(T0)}`).expect(200);

    expect(around.body.data.map((e: { action: string }) => e.action)).toContain('ITEM_REPORTED');
    expect(later.body.data).toEqual([]);
    expect(earlier.body.data).toEqual([]);
  });

  it('refuses a range that ends before it starts, or a date that is not a moment', async () => {
    const backwards = await activity(`from=${iso(T0)}&until=${iso(minutesAfter(T0, -1))}`);
    const notAMoment = await activity('from=yesterday');

    expect(backwards.status).toBe(400);
    expect(backwards.body.error.details).toEqual([
      expect.objectContaining({ path: 'query.until' }),
    ]);
    expect(notAMoment.status).toBe(400);
  });

  it('shows what one person did', async () => {
    await reportItem(t, asha, { title: 'Black phone' });
    await reportItem(t, ravi, { title: 'Blue bottle' });
    await drain();

    const res = await activity(`actorId=${asha.id}`).expect(200);

    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data.every((e: { actor: { id: string } }) => e.actor.id === asha.id)).toBe(
      true,
    );
  });
});

describe('posts', () => {
  it('lists every post of the university, removed ones included, with filters', async () => {
    const phone = await reportItem(t, asha, { title: 'Black phone' });
    await reportItem(t, ravi, { type: 'LOST', title: 'Blue bottle', category: 'BOTTLE' });
    await api().delete(`/api/v1/items/${phone}`).set('Authorization', asha.bearer).expect(204);

    const all = await get(priya, 'items').expect(200);
    const removed = await get(priya, 'items?status=REMOVED').expect(200);
    const lost = await get(priya, 'items?type=LOST').expect(200);
    const search = await get(priya, 'items?q=bottle').expect(200);

    expect(all.body.data.map((i: { title: string }) => i.title)).toEqual([
      'Blue bottle',
      'Black phone',
    ]);
    expect(removed.body.data).toMatchObject([{ id: phone, status: 'REMOVED' }]);
    expect(lost.body.data).toMatchObject([{ title: 'Blue bottle' }]);
    expect(search.body.data).toMatchObject([{ title: 'Blue bottle' }]);
    expect((await get(asha, 'items')).status).toBe(403);
  });
});
