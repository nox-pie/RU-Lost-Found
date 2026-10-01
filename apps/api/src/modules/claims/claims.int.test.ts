import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { daysAfter } from '../../testing/builders';
import { reportItem, signUp, withRole, type SignedInUser } from '../../testing/signedIn';
import { seedUniversity, useTestApp } from '../../testing/testApp';
import { MAX_HANDOVER_ATTEMPTS } from './domain/Claim';

const t = useTestApp();
const api = () => request(t.app);

/** Asha found a phone; Ravi lost it; Kabir is another student; Meera works at the security desk. */
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

const QUESTION = 'What is the lock-screen wallpaper?';

const foundPhone = () => reportItem(t, asha, { questions: QUESTION });

function claim(user: SignedInUser, itemId: string, body: object = {}) {
  return api()
    .post(`/api/v1/items/${itemId}/claims`)
    .set('Authorization', user.bearer)
    .send({
      message: 'It is mine!',
      answers: [{ questionId: 'q1', answer: 'A red car' }],
      ...body,
    });
}

const post = (user: SignedInUser, path: string, body: object = {}) =>
  api().post(`/api/v1/claims/${path}`).set('Authorization', user.bearer).send(body);

const get = (user: SignedInUser, path: string) =>
  api().get(`/api/v1/${path}`).set('Authorization', user.bearer);

async function submitted(user: SignedInUser, itemId: string, body: object = {}) {
  const res = await claim(user, itemId, body);
  expect(res.status).toBe(201);
  return res.body.id as string;
}

async function approve(claimId: string, reporter = asha) {
  const res = await post(reporter, `${claimId}/approve`);
  expect(res.status).toBe(200);
}

/** The handover code, as the item's owner sees it in the app. */
async function codeSeenBy(owner: SignedInUser, claimId: string): Promise<string> {
  const res = await get(owner, `claims/${claimId}`).expect(200);
  return res.body.handover.code as string;
}

const itemStatus = async (itemId: string) => (await get(asha, `items/${itemId}`)).body.status;
const claimOf = async (user: SignedInUser, claimId: string) =>
  (await get(user, `claims/${claimId}`)).body;

describe('found item: the full journey', () => {
  it('goes from claim to approval to handover, sharing contact details only when approved', async () => {
    const setPhone = (user: SignedInUser, phone: string) =>
      api().patch('/api/v1/users/me').set('Authorization', user.bearer).send({ phone });
    await setPhone(ravi, '+91 90000 11111');
    await setPhone(asha, '+91 90000 22222');
    const itemId = await foundPhone();

    // Ravi claims, answering the verification question and offering his phone number.
    const submittedRes = await claim(ravi, itemId, { sharePhone: true });
    expect(submittedRes.status).toBe(201);
    expect(submittedRes.body).toMatchObject({
      kind: 'OWNERSHIP',
      status: 'REQUESTED',
      myRole: 'CLAIMANT',
      contact: null,
      handover: null,
      reporter: { name: 'Asha Verma' },
    });
    const claimId = submittedRes.body.id as string;

    // Asha sees the question and answer, but no contact details yet.
    const forItem = await get(asha, `items/${itemId}/claims`);
    expect(forItem.body.data).toHaveLength(1);
    expect(forItem.body.data[0]).toMatchObject({
      myRole: 'REPORTER',
      answers: [{ questionId: 'q1', question: QUESTION, answer: 'A red car' }],
      contact: null,
    });
    const ids = (res: request.Response) => res.body.data.map((c: { id: string }) => c.id);
    expect(ids(await get(asha, 'claims/received'))).toEqual([claimId]);
    expect(ids(await get(ravi, 'claims/mine'))).toEqual([claimId]);

    // Asha approves without sharing her phone: the item is reserved.
    const approvedRes = await post(asha, `${claimId}/approve`, { sharePhone: false });
    expect(approvedRes.status).toBe(200);
    expect(approvedRes.body).toMatchObject({
      status: 'APPROVED',
      contact: { email: 'ravi@rishihood.edu.in', phone: '+91 90000 11111' },
      handover: { code: null, attemptsLeft: MAX_HANDOVER_ATTEMPTS, viewerEntersCode: true },
    });
    expect(await itemStatus(itemId)).toBe('RESERVED');

    // Ravi (the owner) sees the code and Asha's email, but not her phone.
    const ravisView = await claimOf(ravi, claimId);
    expect(ravisView.handover.code).toMatch(/^\d{6}$/);
    expect(ravisView.handover.viewerEntersCode).toBe(false);
    expect(ravisView.contact).toEqual({ email: 'asha@rishihood.edu.in', phone: null });

    // They meet; Asha enters the code Ravi shows her.
    const handover = await post(asha, `${claimId}/handover`, { code: ravisView.handover.code });
    expect(handover.status).toBe(200);
    expect(handover.body.status).toBe('COMPLETED');
    expect(handover.body.history.map((h: { status: string }) => h.status)).toEqual([
      'REQUESTED',
      'APPROVED',
      'COMPLETED',
    ]);
    expect(await itemStatus(itemId)).toBe('RESOLVED');
  });

  it('turns down the other open claims once the item is handed over', async () => {
    const itemId = await foundPhone();
    const ravisClaim = await submitted(ravi, itemId);
    const kabirsClaim = await submitted(kabir, itemId);
    await approve(ravisClaim);

    await post(asha, `${ravisClaim}/handover`, { code: await codeSeenBy(ravi, ravisClaim) }).expect(
      200,
    );

    expect(await claimOf(kabir, kabirsClaim)).toMatchObject({
      status: 'REJECTED',
      rejectionReason: 'The item was handed over to someone else.',
    });
  });
});

describe('lost item: the finder hands it back', () => {
  it('gives the code to the owner (the reporter) and lets the finder enter it', async () => {
    const itemId = await reportItem(t, asha, { type: 'LOST', title: 'Blue water bottle' });
    const claimId = await submitted(ravi, itemId, { message: 'Found it in room 204', answers: [] });
    await approve(claimId);

    const ashasView = await claimOf(asha, claimId);
    const ravisView = await claimOf(ravi, claimId);
    expect(ashasView.kind).toBe('FINDER');
    expect(ashasView.handover.code).toMatch(/^\d{6}$/);
    expect(ravisView.handover).toMatchObject({ code: null, viewerEntersCode: true });

    const done = await post(ravi, `${claimId}/handover`, { code: ashasView.handover.code });
    expect(done.body.status).toBe('COMPLETED');
    expect(await itemStatus(itemId)).toBe('RESOLVED');
  });
});

describe('submitting a claim', () => {
  it('is refused for your own item, twice for the same item, or without answers', async () => {
    const itemId = await foundPhone();
    await submitted(ravi, itemId);

    const own = await claim(asha, itemId);
    const twice = await claim(ravi, itemId);
    const noAnswers = await claim(kabir, itemId, { answers: [] });

    expect(own.status).toBe(403);
    expect(twice.status).toBe(409);
    expect(twice.body.error.message).toBe('You already have an active claim on this item.');
    expect(noAnswers.status).toBe(400);
  });

  it('is refused once the reporter has declined you on that item', async () => {
    const itemId = await foundPhone();
    const first = await submitted(ravi, itemId);
    await post(asha, `${first}/reject`, { reason: 'Wrong wallpaper' }).expect(200);

    const again = await claim(ravi, itemId);

    expect(again.status).toBe(403);
    expect((await claimOf(ravi, first)).rejectionReason).toBe('Wrong wallpaper');
  });

  it('can be withdrawn and submitted again', async () => {
    const itemId = await foundPhone();
    const first = await submitted(ravi, itemId);

    await post(ravi, `${first}/cancel`).expect(200);

    expect((await claim(ravi, itemId)).status).toBe(201);
  });

  it('is not possible on removed or reserved items', async () => {
    const removed = await foundPhone();
    await api().delete(`/api/v1/items/${removed}`).set('Authorization', asha.bearer).expect(204);
    const reserved = await foundPhone();
    await approve(await submitted(ravi, reserved));

    expect((await claim(kabir, removed)).status).toBe(404);
    expect((await claim(kabir, reserved)).status).toBe(409);
  });
});

describe('deciding on a claim', () => {
  it('is only up to the reporter', async () => {
    const claimId = await submitted(ravi, await foundPhone());

    expect((await post(ravi, `${claimId}/approve`)).status).toBe(403);
    expect((await post(kabir, `${claimId}/reject`)).status).toBe(403);
    expect((await post(meera, `${claimId}/approve`)).status).toBe(403);
  });

  it('allows one approved claim at a time; cancelling it reopens the item', async () => {
    const itemId = await foundPhone();
    const ravisClaim = await submitted(ravi, itemId);
    const kabirsClaim = await submitted(kabir, itemId);
    await approve(ravisClaim);

    const second = await post(asha, `${kabirsClaim}/approve`);
    expect(second.status).toBe(409);
    expect(second.body.error.message).toMatch(/already approved/);

    await post(ravi, `${ravisClaim}/cancel`).expect(200);
    expect(await itemStatus(itemId)).toBe('OPEN');
    expect((await post(asha, `${kabirsClaim}/approve`)).status).toBe(200);
  });

  it('never approves two claims when both approvals arrive at the same moment', async () => {
    const itemId = await foundPhone();
    const ravisClaim = await submitted(ravi, itemId);
    const kabirsClaim = await submitted(kabir, itemId);

    const results = await Promise.all([
      post(asha, `${ravisClaim}/approve`),
      post(asha, `${kabirsClaim}/approve`),
    ]);

    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    const statuses = [await claimOf(asha, ravisClaim), await claimOf(asha, kabirsClaim)].map(
      (c) => c.status,
    );
    expect(statuses.sort()).toEqual(['APPROVED', 'REQUESTED']);
    expect(await itemStatus(itemId)).toBe('RESERVED');
  });
});

describe('handover code', () => {
  it('counts wrong codes, locks after the limit, and then only staff can confirm', async () => {
    const itemId = await foundPhone();
    const claimId = await submitted(ravi, itemId);
    await approve(claimId);
    const code = await codeSeenBy(ravi, claimId);
    const wrong = code === '000000' ? '111111' : '000000';

    const first = await post(asha, `${claimId}/handover`, { code: wrong });
    expect(first.status).toBe(400);
    expect(first.body.error).toMatchObject({
      code: 'HANDOVER_CODE_INCORRECT',
      message: `That code is not right. ${MAX_HANDOVER_ATTEMPTS - 1} attempts left.`,
    });
    expect((await claimOf(asha, claimId)).handover.attemptsLeft).toBe(MAX_HANDOVER_ATTEMPTS - 1);

    for (let i = 1; i < MAX_HANDOVER_ATTEMPTS; i++) {
      await post(asha, `${claimId}/handover`, { code: wrong });
    }
    const withRightCode = await post(asha, `${claimId}/handover`, { code });
    expect(withRightCode.status).toBe(409);
    expect(withRightCode.body.error.code).toBe('HANDOVER_LOCKED');
    expect((await claimOf(asha, claimId)).handover.locked).toBe(true);

    expect((await post(asha, `${claimId}/handover/staff`)).status).toBe(403);
    const byStaff = await post(meera, `${claimId}/handover/staff`);
    expect(byStaff.status).toBe(200);
    expect(byStaff.body).toMatchObject({ status: 'COMPLETED', myRole: 'STAFF', contact: null });
    expect(await itemStatus(itemId)).toBe('RESOLVED');
  });

  it('can only be entered by the person handing the item over', async () => {
    const claimId = await submitted(ravi, await foundPhone());
    await approve(claimId);

    const byOwner = await post(ravi, `${claimId}/handover`, {
      code: await codeSeenBy(ravi, claimId),
    });

    expect(byOwner.status).toBe(403);
  });
});

describe('privacy', () => {
  it('hides a claim from everyone except the two people involved and staff', async () => {
    const claimId = await submitted(ravi, await foundPhone());
    await approve(claimId);

    const outsider = await get(kabir, `claims/${claimId}`);
    const staff = await get(meera, `claims/${claimId}`);

    expect(outsider.status).toBe(404);
    expect(staff.status).toBe(200);
    expect(staff.body).toMatchObject({ myRole: 'STAFF', contact: null });
    expect(staff.body.handover.code).toBeNull();
  });

  it('lets only the reporter list the claims on an item', async () => {
    const itemId = await foundPhone();
    await submitted(ravi, itemId);

    expect((await get(kabir, `items/${itemId}/claims`)).status).toBe(403);
    expect((await get(ravi, `items/${itemId}/claims`)).status).toBe(403);
    expect((await get(meera, `items/${itemId}/claims`)).status).toBe(200);
  });
});

describe('background rules', () => {
  it('expires approved claims whose handover deadline has passed and reopens the item', async () => {
    const itemId = await foundPhone();
    const claimId = await submitted(ravi, itemId);
    await approve(claimId);
    const code = await codeSeenBy(ravi, claimId);

    const now = t.clock.now();
    t.clock.set(daysAfter(now, 8));
    const expired = await t.container.services.claims.expireOverdue();
    t.clock.set(now); // back to when the test users' access tokens are valid

    expect(expired).toBe(1);
    expect((await claimOf(ravi, claimId)).status).toBe('EXPIRED');
    expect(await itemStatus(itemId)).toBe('OPEN');
    expect((await post(asha, `${claimId}/handover`, { code })).status).toBe(409);
    t.clock.set(daysAfter(now, 8));
    expect(await t.container.services.claims.expireOverdue()).toBe(0);
  });

  it('ends the active claims of an item that is removed', async () => {
    const itemId = await foundPhone();
    const requested = await submitted(kabir, itemId);
    const approvedClaim = await submitted(ravi, itemId);
    await approve(approvedClaim);
    await api().delete(`/api/v1/items/${itemId}`).set('Authorization', asha.bearer).expect(204);
    const me = await get(asha, 'users/me');

    const closed = await t.container.services.claims.closeClaimsForRemovedItem(
      { universityId: me.body.universityId },
      itemId,
    );

    expect(closed).toBe(2);
    expect((await claimOf(kabir, requested)).status).toBe('CANCELLED');
    expect((await claimOf(ravi, approvedClaim)).status).toBe('CANCELLED');
  });
});
