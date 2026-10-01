import type { Role } from '@ru-lost-found/shared';
import request from 'supertest';
import { MongoUserRepository } from '../modules/users/infrastructure/MongoUserRepository';
import { T0 } from './builders';
import type { TestApp } from './testApp';

export const TEST_PASSWORD = 'lost-and-found-42';

export interface SignedInUser {
  id: string;
  email: string;
  token: string;
  /** `Authorization` header value. */
  bearer: string;
}

/** Signs a new user up through the real HTTP flow (code → verify → register). */
export async function signUp(
  t: TestApp,
  email: string,
  profile: Partial<{ firstName: string; lastName: string; school: string }> = {},
): Promise<SignedInUser> {
  await request(t.app).post('/api/v1/auth/otp').send({ email, purpose: 'SIGNUP' }).expect(202);
  const verified = await request(t.app)
    .post('/api/v1/auth/otp/verify')
    .send({ email, purpose: 'SIGNUP', code: t.email.codeFor(email) })
    .expect(200);
  const registered = await request(t.app)
    .post('/api/v1/auth/register')
    .send({
      verificationToken: verified.body.verificationToken,
      password: TEST_PASSWORD,
      firstName: profile.firstName ?? 'Asha',
      lastName: profile.lastName ?? 'Verma',
      year: 2,
      school: profile.school ?? 'Newton School of Technology',
      enrollmentNumber: 'NST23001',
    })
    .expect(201);

  const token = registered.body.accessToken as string;
  return { id: registered.body.user.id, email, token, bearer: `Bearer ${token}` };
}

/** Gives an existing user a role and signs in again so the new token carries it. */
export async function withRole(t: TestApp, user: SignedInUser, role: Role): Promise<SignedInUser> {
  const users = new MongoUserRepository(t.connection);
  const stored = await users.findById(user.id);
  if (!stored) throw new Error(`User ${user.id} not found`);
  stored.appointBySystem(role, T0);
  await users.update(stored);

  const res = await request(t.app)
    .post('/api/v1/auth/login')
    .send({ email: user.email, password: TEST_PASSWORD })
    .expect(200);
  const token = res.body.accessToken as string;
  return { ...user, token, bearer: `Bearer ${token}` };
}

/** Real 8×8 images (they are decoded and re-encoded on upload, so fake bytes would be refused). */
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAEUlEQVR4nGN4ZumGFTEMLQkAB9VZQdrTxMwAAAAASUVORK5CYII=',
  'base64',
);
const TINY_JPEG = Buffer.from(
  '/9j/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAIAAgDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAABQf/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCOAFWF/9k=',
  'base64',
);

/** A real image; `paddingBytes` makes it larger (only for size-limit tests, which reject it early). */
export const fakePng = (paddingBytes = 0) => Buffer.concat([TINY_PNG, Buffer.alloc(paddingBytes)]);
export const fakeJpeg = (paddingBytes = 0) =>
  Buffer.concat([TINY_JPEG, Buffer.alloc(paddingBytes)]);

/** Reports an item through the real multipart endpoint and returns its id. */
export async function reportItem(
  t: TestApp,
  user: SignedInUser,
  fields: Record<string, string | string[]> = {},
): Promise<string> {
  const all: Record<string, string | string[]> = {
    type: 'FOUND',
    category: 'ELECTRONICS',
    title: 'Black phone',
    description: 'Found near the library entrance.',
    location: 'Library',
    occurredOn: '2026-10-01',
    ...fields,
  };
  let req = request(t.app).post('/api/v1/items').set('Authorization', user.bearer);
  for (const [name, value] of Object.entries(all)) {
    for (const one of ([] as string[]).concat(value)) req = req.field(name, one);
  }
  const res = await req.attach('photos', fakeJpeg(), 'photo.jpg');
  if (res.status !== 201) throw new Error(`Reporting failed: ${JSON.stringify(res.body)}`);
  return res.body.id as string;
}
