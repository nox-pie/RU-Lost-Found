import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { T0 } from '../../testing/builders';
import { reportItem, signUp, type SignedInUser } from '../../testing/signedIn';
import { seedUniversity, useTestApp } from '../../testing/testApp';

const t = useTestApp();
const api = () => request(t.app);

/** Ravi lost his phone; Asha finds things. */
let asha: SignedInUser;
let ravi: SignedInUser;

beforeEach(async () => {
  await seedUniversity(t.connection);
  asha = await signUp(t, 'asha@rishihood.edu.in', { firstName: 'Asha', lastName: 'Verma' });
  ravi = await signUp(t, 'ravi@rishihood.edu.in', { firstName: 'Ravi', lastName: 'Singh' });
});

const lostPhone = () =>
  reportItem(t, ravi, {
    type: 'LOST',
    title: 'Black iPhone 13',
    description: 'Black iPhone with a cracked screen protector and a blue case.',
    place: 'Library',
  });
const foundPhone = () =>
  reportItem(t, asha, {
    title: 'Black phone',
    description: 'Found a black iPhone in a blue case, the screen protector is cracked.',
    place: 'Library',
  });
const matchesOf = (user: SignedInUser, itemId: string) =>
  api().get(`/api/v1/items/${itemId}/matches`).set('Authorization', user.bearer);

describe('possible matches', () => {
  it('shows the reporter of a lost post the likely found posts, best first', async () => {
    const lost = await lostPhone();
    const phone = await foundPhone();
    const similar = await reportItem(t, asha, {
      title: 'Phone',
      description: 'A phone left on a table.',
      place: 'Library',
    });
    await reportItem(t, asha, { title: 'Grey charger cable', description: 'USB-C charger cable.' });
    await reportItem(t, asha, { category: 'WALLET', title: 'Black wallet', place: 'Library' });

    const res = await matchesOf(ravi, lost);

    expect(res.status).toBe(200);
    expect(res.body.data.map((m: { item: { id: string } }) => m.item.id)).toEqual([phone, similar]);
    expect(res.body.data[0]).toMatchObject({ strong: true, item: { title: 'Black phone' } });
    expect(res.body.data[1].strong).toBe(false);
  });

  it('works the other way round: a finder sees lost posts their find may belong to', async () => {
    const lost = await lostPhone();
    const phone = await foundPhone();

    const res = await matchesOf(asha, phone);

    expect(res.body.data.map((m: { item: { id: string } }) => m.item.id)).toEqual([lost]);
  });

  it('never pair a real post with a sample post of the demo', async () => {
    await t.container.services.demo.seed(T0); // includes a found "Black bifold wallet"
    const lostWallet = await reportItem(t, ravi, {
      type: 'LOST',
      category: 'WALLET',
      title: 'Black bifold wallet',
      description: 'My black bifold wallet with my library card inside.',
      occurredOn: T0.toISOString().slice(0, 10),
    });

    expect((await matchesOf(ravi, lostWallet)).body.data).toEqual([]);
  });

  it('are shown only to the post’s reporter', async () => {
    const lost = await lostPhone();
    expect((await matchesOf(asha, lost)).status).toBe(403);
  });
});

describe('a new found post that strongly matches a lost one', () => {
  it('tells the owner of the lost post, in the app and by email', async () => {
    await lostPhone();
    const phone = await foundPhone();
    await t.container.worker.drain();

    const notifications = await api()
      .get('/api/v1/notifications')
      .set('Authorization', ravi.bearer);
    expect(notifications.body.data).toMatchObject([
      {
        type: 'POSSIBLE_MATCH',
        title: 'Someone may have found your “Black iPhone 13”',
        link: { itemId: phone },
      },
    ]);
    expect(t.email.to(ravi.email).map((m) => m.subject)).toContain(
      'Someone may have found your “Black iPhone 13”',
    );
  });

  it('stays quiet for weak matches', async () => {
    await lostPhone();
    await reportItem(t, asha, { title: 'Phone', description: 'A phone left on a table.' });
    await t.container.worker.drain();

    const notifications = await api()
      .get('/api/v1/notifications')
      .set('Authorization', ravi.bearer);
    expect(notifications.body.data).toEqual([]);
  });
});
