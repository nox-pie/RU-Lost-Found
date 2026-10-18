import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  reportItem,
  setStoredRole,
  signUp,
  withRole,
  type SignedInUser,
} from '../../testing/signedIn';
import { seedUniversity, useTestApp } from '../../testing/testApp';

const t = useTestApp();
const api = () => request(t.app);

/** Asha finds things; Ravi and Kabir lose things; Meera works at the security desk. */
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

async function claimOn(itemId: string, claimant: SignedInUser): Promise<string> {
  const res = await post(claimant, `items/${itemId}/claims`, { message: 'It is mine!' });
  expect(res.status).toBe(201);
  return res.body.id as string;
}

async function approvedClaim(itemId: string, claimant: SignedInUser): Promise<string> {
  const claimId = await claimOn(itemId, claimant);
  await post(asha, `claims/${claimId}/approve`).expect(200);
  return claimId;
}

describe('handovers waiting at the desk', () => {
  it('lists every approved claim of the university, newest first, without codes or contacts', async () => {
    const first = await approvedClaim(await reportItem(t, asha, { title: 'Blue bottle' }), ravi);
    const second = await approvedClaim(await reportItem(t, asha, { title: 'Grey hoodie' }), kabir);
    await claimOn(await reportItem(t, asha, { title: 'Umbrella' }), ravi); // only requested
    const done = await approvedClaim(await reportItem(t, asha, { title: 'Keys' }), kabir);
    await post(meera, `claims/${done}/handover/staff`).expect(200);

    const res = await get(meera, 'desk/handovers');

    expect(res.status).toBe(200);
    expect(res.body.data.map((c: { id: string }) => c.id)).toEqual([second, first]);
    expect(res.body.data[0]).toMatchObject({
      status: 'APPROVED',
      myRole: 'STAFF',
      contact: null,
      item: { title: 'Grey hoodie' },
      claimant: { name: 'Kabir Rao' },
      reporter: { name: 'Asha Verma' },
      handover: { code: null, locked: false },
    });
    expect(res.body.nextCursor).toBeNull();
  });

  it('pages through long lists', async () => {
    const ids: string[] = [];
    for (const title of ['Bottle', 'Hoodie', 'Charger']) {
      ids.unshift(await approvedClaim(await reportItem(t, asha, { title }), ravi));
    }

    const page1 = await get(meera, 'desk/handovers?limit=2').expect(200);
    const page2 = await get(
      meera,
      `desk/handovers?limit=2&cursor=${encodeURIComponent(page1.body.nextCursor as string)}`,
    ).expect(200);

    expect([...page1.body.data, ...page2.body.data].map((c: { id: string }) => c.id)).toEqual(ids);
    expect(page2.body.nextCursor).toBeNull();
  });
});

describe('items held at the desk', () => {
  it('lists found items handed in at the desk until they go back to their owner', async () => {
    const waiting = await reportItem(t, asha, { title: 'Blue bottle', heldAtSecurityDesk: 'true' });
    const reserved = await reportItem(t, asha, {
      title: 'Grey hoodie',
      heldAtSecurityDesk: 'true',
    });
    await approvedClaim(reserved, ravi);
    const returned = await reportItem(t, asha, { title: 'Keys', heldAtSecurityDesk: 'true' });
    await post(meera, `claims/${await approvedClaim(returned, kabir)}/handover/staff`).expect(200);
    const removed = await reportItem(t, asha, { title: 'Pen', heldAtSecurityDesk: 'true' });
    await api().delete(`/api/v1/items/${removed}`).set('Authorization', asha.bearer).expect(204);
    await reportItem(t, asha, { title: 'Charger' }); // kept by Asha herself

    const res = await get(meera, 'desk/items');

    expect(res.status).toBe(200);
    expect(res.body.data.map((i: { id: string; status: string }) => [i.id, i.status])).toEqual([
      [reserved, 'RESERVED'],
      [waiting, 'OPEN'],
    ]);
    expect(res.body.data[0]).toMatchObject({ heldAtSecurityDesk: true, title: 'Grey hoodie' });
  });

  it('can be searched by words in the post', async () => {
    await reportItem(t, asha, { title: 'Blue bottle', heldAtSecurityDesk: 'true' });
    const hoodie = await reportItem(t, asha, { title: 'Grey hoodie', heldAtSecurityDesk: 'true' });

    const res = await get(meera, 'desk/items?q=hoodie').expect(200);

    expect(res.body.data.map((i: { id: string }) => i.id)).toEqual([hoodie]);
  });
});

describe('access', () => {
  it('is for security desk staff and admins only, by the role stored now', async () => {
    const admin = await withRole(t, kabir, 'UNIVERSITY_ADMIN');

    expect((await api().get('/api/v1/desk/handovers')).status).toBe(401);
    expect((await get(ravi, 'desk/handovers')).status).toBe(403);
    expect((await get(ravi, 'desk/items')).status).toBe(403);
    expect((await get(admin, 'desk/handovers')).status).toBe(200);
    expect((await get(meera, 'desk/items')).status).toBe(200);

    await setStoredRole(t, meera, 'STUDENT'); // her token still says SECURITY_DESK
    expect((await get(meera, 'desk/handovers')).status).toBe(403);
    expect((await get(meera, 'desk/items')).status).toBe(403);
  });
});
