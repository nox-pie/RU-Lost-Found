import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { daysAfter } from '../../testing/builders';
import { reportItem, signUp, type SignedInUser } from '../../testing/signedIn';
import { seedUniversity, useTestApp } from '../../testing/testApp';

const t = useTestApp();
const api = () => request(t.app);

let asha: SignedInUser;
let ravi: SignedInUser;
let kabir: SignedInUser;

beforeEach(async () => {
  await seedUniversity(t.connection);
  asha = await signUp(t, 'asha@rishihood.edu.in', { firstName: 'Asha', lastName: 'Verma' });
  ravi = await signUp(t, 'ravi@rishihood.edu.in', { firstName: 'Ravi', lastName: 'Singh' });
  kabir = await signUp(t, 'kabir@rishihood.edu.in', { firstName: 'Kabir', lastName: 'Rao' });
  await drain();
  t.email.clear();
});

/** Delivers all pending events, as the background worker would within a couple of seconds. */
const drain = () => t.container.worker.drain();

const notificationsOf = async (user: SignedInUser, query = '') =>
  (await api().get(`/api/v1/notifications${query}`).set('Authorization', user.bearer)).body;

async function claimOnPhone(claimant: SignedInUser, itemId: string) {
  const res = await api()
    .post(`/api/v1/items/${itemId}/claims`)
    .set('Authorization', claimant.bearer)
    .send({ answers: [{ questionId: 'q1', answer: 'A red car' }] })
    .expect(201);
  return res.body.id as string;
}

const act = (user: SignedInUser, claimId: string, action: string, body: object = {}) =>
  api()
    .post(`/api/v1/claims/${claimId}/${action}`)
    .set('Authorization', user.bearer)
    .send(body)
    .expect(200);

const foundPhone = () =>
  reportItem(t, asha, { questions: 'What is the lock-screen wallpaper?', title: 'Black phone' });

describe('claim notifications', () => {
  it('tells each person what they need to know at every step', async () => {
    const itemId = await foundPhone();
    const claimId = await claimOnPhone(ravi, itemId);
    const kabirsClaim = await claimOnPhone(kabir, itemId);
    await drain();

    // The reporter hears about both claims, in the app and by email.
    const ashas = await notificationsOf(asha);
    expect(ashas.unreadCount).toBe(2);
    expect(ashas.data[0]).toMatchObject({
      type: 'CLAIM_RECEIVED',
      title: 'New claim on “Black phone”',
      read: false,
      link: { itemId },
    });
    expect(t.email.to(asha.email).map((m) => m.subject)).toEqual([
      'New claim on “Black phone”',
      'New claim on “Black phone”',
    ]);

    // Approval: Ravi (the owner) is emailed the handover code.
    await act(asha, claimId, 'approve');
    await drain();
    const code = (await api().get(`/api/v1/claims/${claimId}`).set('Authorization', ravi.bearer))
      .body.handover.code as string;
    const approvalEmail = t.email.to(ravi.email).at(-1);
    expect(approvalEmail?.subject).toBe('Your claim was approved');
    expect(approvalEmail?.text).toContain(`Handover code: ${code}`);
    expect(approvalEmail?.html).toContain(`http://localhost:5173/claims/${claimId}`);

    // Handover: both are told; Kabir's claim is closed in the app, without an email.
    t.email.clear();
    await act(asha, claimId, 'handover', { code });
    await drain();
    expect((await notificationsOf(ravi)).data[0].type).toBe('HANDOVER_COMPLETED');
    expect((await notificationsOf(asha)).data[0].type).toBe('HANDOVER_COMPLETED');
    const kabirs = await notificationsOf(kabir);
    expect(kabirs.data[0]).toMatchObject({
      type: 'CLAIM_REJECTED',
      body: '“Black phone” was handed over to someone else, so your claim was closed.',
      link: { claimId: kabirsClaim },
    });
    expect(t.email.to(kabir.email)).toHaveLength(0);
  });

  it('emails a declined claimant, escaping anything they typed', async () => {
    const itemId = await reportItem(t, asha, {
      title: '<b>Phone</b> & charger',
      questions: 'What is the lock-screen wallpaper?',
    });
    const claimId = await claimOnPhone(ravi, itemId);

    await act(asha, claimId, 'reject', { reason: 'Wrong wallpaper' });
    await drain();

    const email = t.email.to(ravi.email).at(-1);
    expect(email?.subject).toBe('Your claim was declined');
    expect(email?.html).toContain('&lt;b&gt;Phone&lt;/b&gt; &amp; charger');
    expect(email?.html).not.toContain('<b>Phone</b>');
  });

  it('does not notify twice if an event is delivered again', async () => {
    const itemId = await foundPhone();
    await claimOnPhone(ravi, itemId);
    await drain();

    // Simulate a redelivery (e.g. a worker crashed after handling but before marking done).
    await t.connection
      .collection('outbox_events')
      .updateMany({}, { $set: { status: 'PENDING', completedHandlers: [] } });
    await drain();

    expect((await notificationsOf(asha)).data).toHaveLength(1);
  });
});

describe('reacting to other modules', () => {
  it('closes the claims of a removed item and tells the claimants', async () => {
    const itemId = await foundPhone();
    const claimId = await claimOnPhone(ravi, itemId);
    await drain();

    await api().delete(`/api/v1/items/${itemId}`).set('Authorization', asha.bearer).expect(204);
    await drain();

    const claim = await api().get(`/api/v1/claims/${claimId}`).set('Authorization', ravi.bearer);
    expect(claim.body.status).toBe('CANCELLED');
    expect((await notificationsOf(ravi)).data[0]).toMatchObject({
      type: 'CLAIM_CANCELLED',
      body: '“Black phone” was removed, so your claim was closed.',
    });
  });

  it('warns the user by email when their password changes', async () => {
    await api().post('/api/v1/auth/otp').send({ email: ravi.email, purpose: 'PASSWORD_RESET' });
    const verify = await api()
      .post('/api/v1/auth/otp/verify')
      .send({ email: ravi.email, purpose: 'PASSWORD_RESET', code: t.email.codeFor(ravi.email) });
    await api()
      .post('/api/v1/auth/password/reset')
      .send({ verificationToken: verify.body.verificationToken, newPassword: 'brand-new-pass-9' })
      .expect(200);

    await drain();

    expect(t.email.to(ravi.email).at(-1)?.subject).toBe('Your password was changed');
  });
});

describe('scheduled jobs', () => {
  it('expires overdue handovers and tells both people', async () => {
    const itemId = await foundPhone();
    const claimId = await claimOnPhone(ravi, itemId);
    await act(asha, claimId, 'approve');
    await drain();

    const now = t.clock.now();
    t.clock.set(daysAfter(now, 8));
    await t.container.worker.scheduler.runNow('expire-claims');
    await drain();
    t.clock.set(now);

    expect((await notificationsOf(ravi)).data[0].type).toBe('CLAIM_EXPIRED');
    expect((await notificationsOf(asha)).data[0].type).toBe('CLAIM_EXPIRED');
    expect(t.email.to(ravi.email).at(-1)?.subject).toBe('A claim expired');
  });

  it('deletes the photos of items removed more than 30 days ago', async () => {
    const itemId = await foundPhone();
    await api().delete(`/api/v1/items/${itemId}`).set('Authorization', asha.bearer).expect(204);
    const now = t.clock.now();

    t.clock.set(daysAfter(now, 29));
    expect(await t.container.worker.scheduler.runNow('purge-removed-item-photos')).toBe(0);
    t.clock.set(daysAfter(now, 31));
    expect(await t.container.worker.scheduler.runNow('purge-removed-item-photos')).toBe(1);

    expect(t.storage.deleted).toHaveLength(1);
    expect(t.storage.stored.size).toBe(0);
  });
});

describe('outbox housekeeping', () => {
  it('deletes delivered events after a week', async () => {
    await foundPhone();
    await drain();
    const outbox = t.connection.collection('outbox_events');
    const delivered = await outbox.countDocuments({ status: 'DONE' });
    expect(delivered).toBeGreaterThan(0);

    t.clock.set(daysAfter(t.clock.now(), 6));
    expect(await t.container.worker.scheduler.runNow('prune-outbox')).toBe(0);
    t.clock.set(daysAfter(t.clock.now(), 2));
    expect(await t.container.worker.scheduler.runNow('prune-outbox')).toBe(delivered);
    expect(await outbox.countDocuments({})).toBe(0);
  });
});

describe('notification inbox', () => {
  it('filters unread, marks some or all as read, and never touches other people’s', async () => {
    const itemId = await foundPhone();
    const first = await claimOnPhone(ravi, itemId);
    await claimOnPhone(kabir, itemId);
    await act(asha, first, 'reject');
    await drain();
    const [newest, older] = (await notificationsOf(asha)).data;
    const ravisNotification = (await notificationsOf(ravi)).data[0];

    const marked = await api()
      .post('/api/v1/notifications/read')
      .set('Authorization', asha.bearer)
      .send({ ids: [newest.id, ravisNotification.id] });
    expect(marked.body).toEqual({ unreadCount: 1 });
    expect(
      (await notificationsOf(asha, '?unread=true')).data.map((n: { id: string }) => n.id),
    ).toEqual([older.id]);
    expect((await notificationsOf(ravi)).unreadCount).toBe(1);

    await api().post('/api/v1/notifications/read').set('Authorization', asha.bearer).send({});
    expect((await notificationsOf(asha)).unreadCount).toBe(0);
  });
});
