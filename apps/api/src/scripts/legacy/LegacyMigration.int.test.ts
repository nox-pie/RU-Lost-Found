import bcrypt from 'bcrypt';
import { Types } from 'mongoose';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createLogger } from '../../core/logger/logger';
import { MongoItemRepository } from '../../modules/items/infrastructure/MongoItemRepository';
import type { University } from '../../modules/universities/domain/University';
import { MongoUserRepository } from '../../modules/users/infrastructure/MongoUserRepository';
import { signUp } from '../../testing/signedIn';
import { seedUniversity, useTestApp } from '../../testing/testApp';
import { useTestDatabase } from '../../testing/testDatabase';
import { LegacyMigration } from './LegacyMigration';
import { imageFromUrl } from './legacyMapping';

const t = useTestApp();
const old = useTestDatabase();
const logger = createLogger({ NODE_ENV: 'test', LOG_LEVEL: 'silent' });
const OLD_PASSWORD = 'my-old-password-1';
const PHOTO =
  'https://res.cloudinary.com/demo/image/upload/v1712345678/ru_lost_found/image-1712-abc.jpg';

let university: University;
let ashaId: Types.ObjectId;

beforeEach(async () => {
  university = await seedUniversity(t.connection);
  const hash = await bcrypt.hash(OLD_PASSWORD, 4);
  ashaId = new Types.ObjectId();
  const outsiderId = new Types.ObjectId();
  await old.connection.collection('users').insertMany([
    {
      _id: ashaId,
      email: 'Asha@rishihood.edu.in',
      password: hash,
      firstName: 'Asha',
      lastName: 'Verma',
      year: '3',
      school: 'Newton School of Technology',
      enrollmentNumber: 'NST21001',
      phone: '',
      profilePicture: '',
      createdAt: new Date('2025-02-01T10:00:00Z'),
      updatedAt: new Date('2025-02-01T10:00:00Z'),
    },
    {
      _id: outsiderId,
      email: 'someone@gmail.com',
      password: hash,
      firstName: 'Out',
      lastName: 'Sider',
      year: '1',
      school: 'Newton School of Technology',
      enrollmentNumber: 'X1',
    },
  ]);
  await old.connection.collection('items').insertMany([
    {
      type: 'found',
      title: 'Blue water bottle',
      description: 'Found near the basketball court',
      location: 'Sports complex',
      date: '2025-03-04',
      reporter: 'Asha Verma',
      reporterId: ashaId,
      status: 'open',
      image: PHOTO,
      createdAt: new Date('2025-03-04T09:00:00Z'),
      updatedAt: new Date('2025-03-04T09:00:00Z'),
    },
    {
      type: 'lost',
      title: 'Calculator',
      description: 'Casio fx-991',
      location: 'Library',
      date: 'not a date',
      reporter: 'Asha Verma',
      reporterId: ashaId,
      status: 'claimed',
      claimedBy: { name: 'Ravi', contact: '+91 99999 00000', details: 'Room 12' },
      createdAt: new Date('2025-03-05T09:00:00Z'),
      updatedAt: new Date('2025-03-09T09:00:00Z'),
    },
    {
      type: 'lost',
      title: 'Wallet',
      description: 'Brown leather',
      location: 'Canteen',
      date: '2025-03-06',
      reporter: 'Out Sider',
      reporterId: outsiderId,
      status: 'open',
    },
  ]);
});

const migration = () =>
  new LegacyMigration(
    old.connection,
    {
      users: new MongoUserRepository(t.connection),
      items: new MongoItemRepository(t.connection),
    },
    university,
    logger,
  );

describe('migrating the first version’s data', () => {
  it('only reports on a dry run', async () => {
    const report = await migration().run({ apply: false });

    expect(report).toMatchObject({
      dryRun: true,
      users: { read: 2, migrated: 1, skipped: { 'email is not a university address': 1 } },
      items: { read: 3, migrated: 2, skipped: { 'its reporter was not migrated': 1 } },
      claimNotesDropped: 1,
    });
    expect(await new MongoUserRepository(t.connection).findById(ashaId.toHexString())).toBeNull();
  });

  it('moves accounts and items: people sign in with their old password and see their posts', async () => {
    await migration().run({ apply: true });

    const login = await request(t.app)
      .post('/api/v1/auth/login')
      .send({ email: 'asha@rishihood.edu.in', password: OLD_PASSWORD })
      .expect(200);
    expect(login.body.user).toMatchObject({ id: ashaId.toHexString(), year: 3, phone: null });

    const mine = await request(t.app)
      .get('/api/v1/items/mine')
      .set('Authorization', `Bearer ${login.body.accessToken as string}`)
      .expect(200);
    const byTitle = Object.fromEntries(
      (mine.body.data as { title: string }[]).map((item) => [item.title, item]),
    );
    expect(byTitle['Blue water bottle']).toMatchObject({
      type: 'FOUND',
      category: 'OTHER',
      status: 'OPEN',
      occurredOn: '2025-03-04',
      photos: [
        'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,c_limit,w_1600/v1712345678/ru_lost_found/image-1712-abc.jpg',
      ],
    });
    // "claimed" meant handed back; an invalid date falls back to the day it was posted.
    expect(byTitle.Calculator).toMatchObject({
      status: 'RESOLVED',
      occurredOn: '2025-03-05',
      resolvedAt: '2025-03-09T09:00:00.000Z',
    });
  });

  it('can run again without duplicating anything, and sends no emails', async () => {
    await migration().run({ apply: true });
    const again = await migration().run({ apply: true });

    expect(again.users).toMatchObject({ migrated: 0, alreadyThere: 1 });
    expect(again.items).toMatchObject({ migrated: 0, alreadyThere: 2 });
    await t.container.worker.drain();
    expect(t.email.sent).toHaveLength(0);
  });

  it('links old posts to the new account of someone who already signed up again', async () => {
    const asha = await signUp(t, 'asha@rishihood.edu.in');

    const report = await migration().run({ apply: true });

    expect(report.users.alreadyThere).toBe(1);
    const mine = await request(t.app)
      .get('/api/v1/items/mine')
      .set('Authorization', asha.bearer)
      .expect(200);
    expect(mine.body.data).toHaveLength(2);
  });
});

describe('imageFromUrl', () => {
  it('keeps the Cloudinary public id so the image can be deleted later', () => {
    expect(imageFromUrl(PHOTO)).toEqual({
      url: expect.stringContaining('/upload/f_auto,q_auto,c_limit,w_1600/v1712345678/'),
      publicId: 'ru_lost_found/image-1712-abc',
    });
    expect(imageFromUrl('https://example.com/a.png')?.publicId).toMatch(/^legacy\/[0-9a-f]{40}$/);
    expect(imageFromUrl('  ')).toBeNull();
  });
});
