import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { signUp } from '../../testing/signedIn';
import { seedUniversity, useTestApp } from '../../testing/testApp';
import { MongoUserRepository } from './infrastructure/MongoUserRepository';

const OWNER = 'owner@rishihood.edu.in';
const t = useTestApp({
  env: { ADMIN_EMAILS: ` ${OWNER.toUpperCase()} , second@rishihood.edu.in` },
});

beforeEach(async () => {
  await seedUniversity(t.connection);
});

const roleOf = async (id: string) =>
  (await new MongoUserRepository(t.connection).findById(id))?.role;

describe('ADMIN_EMAILS', () => {
  it('makes a listed email a platform admin as soon as it signs up', async () => {
    const owner = await signUp(t, OWNER);
    const student = await signUp(t, 'asha@rishihood.edu.in');

    expect(await roleOf(owner.id)).toBe('PLATFORM_ADMIN');
    expect(await roleOf(student.id)).toBe('STUDENT');

    // The appointment is audited, by "the system".
    await t.container.worker.drain();
    const login = await request(t.app)
      .post('/api/v1/auth/login')
      .send({ email: OWNER, password: 'lost-and-found-42' })
      .expect(200);
    const log = await request(t.app)
      .get(`/api/v1/admin/audit?action=USER_ROLE_CHANGED&targetId=${owner.id}`)
      .set('Authorization', `Bearer ${login.body.accessToken as string}`)
      .expect(200);
    expect(log.body.data).toMatchObject([{ actor: null, metadata: { to: 'PLATFORM_ADMIN' } }]);
  });

  it('appoints existing accounts at startup, once', async () => {
    const users = new MongoUserRepository(t.connection);
    const owner = await signUp(t, 'second@rishihood.edu.in');
    const stored = await users.findById(owner.id);
    stored!.appointBySystem('STUDENT', t.clock.now());
    await users.update(stored!);

    expect(await t.container.services.adminAccounts.ensure()).toBe(1);
    expect(await roleOf(owner.id)).toBe('PLATFORM_ADMIN');
    expect(await t.container.services.adminAccounts.ensure()).toBe(0);
  });
});
