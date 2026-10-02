import request, { type Response } from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { T0, daysAfter, minutesAfter } from '../../testing/builders';
import { seedUniversity, useTestApp } from '../../testing/testApp';
import { MongoUniversityRepository } from '../universities/infrastructure/MongoUniversityRepository';
import { MongoUserRepository } from '../users/infrastructure/MongoUserRepository';
import { OTP_MAX_ATTEMPTS } from './OtpService';
import { REFRESH_COOKIE } from './auth.controller';
import { LOGIN_FAILURE_LIMITS } from './LoginThrottle';
import { OTP_MAX_DAILY_FAILURES } from './OtpService';

const t = useTestApp();
const EMAIL = 'asha.v23@nst.rishihood.edu.in';
const PASSWORD = 'lost-and-found-42';

const profile = {
  firstName: 'Asha',
  lastName: 'Verma',
  year: 2,
  school: 'Newton School of Technology',
  enrollmentNumber: 'NST23/0042',
  phone: '+91 98765 43210',
};

beforeEach(async () => {
  await seedUniversity(t.connection);
});

const api = () => request(t.app);

/** The `rlf_refresh=...` pair from a response, ready to send back as a Cookie header. */
function refreshCookie(res: Response): string {
  const cookies = ([] as string[]).concat(res.headers['set-cookie'] ?? []);
  const cookie = cookies.find((c) => c.startsWith(`${REFRESH_COOKIE}=`));
  if (!cookie) throw new Error('No refresh cookie was set');
  return cookie.split(';')[0] as string;
}

async function verifiedToken(email: string, purpose: 'SIGNUP' | 'PASSWORD_RESET') {
  await api().post('/api/v1/auth/otp').send({ email, purpose }).expect(202);
  const res = await api()
    .post('/api/v1/auth/otp/verify')
    .send({ email, purpose, code: t.email.codeFor(email) })
    .expect(200);
  return res.body.verificationToken as string;
}

async function signUp(email = EMAIL) {
  const verificationToken = await verifiedToken(email, 'SIGNUP');
  const res = await api()
    .post('/api/v1/auth/register')
    .send({ verificationToken, password: PASSWORD, ...profile })
    .expect(201);
  t.clock.set(minutesAfter(t.clock.now(), 2)); // step past the resend cooldown
  return { accessToken: res.body.accessToken as string, cookie: refreshCookie(res), res };
}

describe('sign-up', () => {
  it('verifies the email with a code, then creates the account and signs in', async () => {
    const otp = await api().post('/api/v1/auth/otp').send({ email: EMAIL, purpose: 'SIGNUP' });
    expect(otp.status).toBe(202);
    expect(t.email.to(EMAIL)).toHaveLength(1);

    const verify = await api()
      .post('/api/v1/auth/otp/verify')
      .send({ email: EMAIL, purpose: 'SIGNUP', code: t.email.codeFor(EMAIL) });
    expect(verify.status).toBe(200);
    expect(verify.body.university).toMatchObject({
      name: 'Rishihood University',
      schools: ['Newton School of Technology', 'School of Entrepreneurship'],
    });

    const register = await api()
      .post('/api/v1/auth/register')
      .send({ verificationToken: verify.body.verificationToken, password: PASSWORD, ...profile });
    expect(register.status).toBe(201);
    expect(register.body.user).toMatchObject({ email: EMAIL, role: 'STUDENT', ...profile });
    expect(register.body.user).not.toHaveProperty('passwordHash');
    expect(register.body.expiresIn).toBe(900);

    const cookie = ([] as string[]).concat(register.headers['set-cookie'] ?? []).join(';');
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(cookie).toMatch(/Path=\/api\/v1\/auth/);

    const me = await api()
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${register.body.accessToken}`);
    expect(me.status).toBe(200);
    expect(me.body.email).toBe(EMAIL);
  });

  it('only accepts university email addresses', async () => {
    const res = await api()
      .post('/api/v1/auth/otp')
      .send({ email: 'someone@gmail.com', purpose: 'SIGNUP' });

    expect(res.status).toBe(400);
    expect(t.email.sent).toHaveLength(0);
  });

  it('accepts any verified address when the university is open to any email', async () => {
    const universities = new MongoUniversityRepository(t.connection);
    const rishihood = await universities.findBySlug('rishihood');
    rishihood!.updateSettings(
      {
        name: rishihood!.name,
        emailDomains: [...rishihood!.emailDomains, '*'],
        schools: [...rishihood!.schools],
      },
      t.clock.now(),
    );
    await universities.update(rishihood!);

    const { res } = await signUp('recruiter@gmail.com');

    expect(res.body.user).toMatchObject({
      email: 'recruiter@gmail.com',
      universityId: rishihood!.id,
    });
  });

  it('answers the same for an existing account, but emails a notice instead of a code', async () => {
    await signUp();
    t.email.clear();

    const res = await api().post('/api/v1/auth/otp').send({ email: EMAIL, purpose: 'SIGNUP' });

    expect(res.status).toBe(202);
    expect(t.email.to(EMAIL)).toHaveLength(1);
    expect(t.email.to(EMAIL)[0]?.subject).toMatch(/already have/);
    expect(() => t.email.codeFor(EMAIL)).toThrow();
  });

  it('never stores the code in plain text', async () => {
    await api().post('/api/v1/auth/otp').send({ email: EMAIL, purpose: 'SIGNUP' });
    const code = t.email.codeFor(EMAIL);

    const stored = await t.store.get(`otp:SIGNUP:${EMAIL}`);

    expect(stored).toMatch(/^[0-9a-f]{64}$/);
    expect(stored).not.toContain(code);
  });

  it('locks the code after too many wrong guesses, even if the right code follows', async () => {
    await api().post('/api/v1/auth/otp').send({ email: EMAIL, purpose: 'SIGNUP' });
    const code = t.email.codeFor(EMAIL);
    const wrong = code === '000000' ? '111111' : '000000';

    for (let i = 0; i < OTP_MAX_ATTEMPTS; i++) {
      await api()
        .post('/api/v1/auth/otp/verify')
        .send({ email: EMAIL, purpose: 'SIGNUP', code: wrong })
        .expect(400);
    }
    const res = await api()
      .post('/api/v1/auth/otp/verify')
      .send({ email: EMAIL, purpose: 'SIGNUP', code });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/Too many incorrect attempts/);
  });

  it('caps wrong codes per day, even across freshly requested codes', async () => {
    const body = { email: EMAIL, purpose: 'SIGNUP' };
    let minutes = 0;
    for (let round = 0; round < OTP_MAX_DAILY_FAILURES / OTP_MAX_ATTEMPTS; round++) {
      await api().post('/api/v1/auth/otp').send(body).expect(202);
      const wrong = t.email.codeFor(EMAIL) === '000000' ? '111111' : '000000';
      for (let i = 0; i < OTP_MAX_ATTEMPTS; i++) {
        await api()
          .post('/api/v1/auth/otp/verify')
          .send({ ...body, code: wrong });
      }
      t.clock.set(minutesAfter(T0, (minutes += 2))); // past the resend cooldown
    }
    await api().post('/api/v1/auth/otp').send(body).expect(202);

    const withRightCode = await api()
      .post('/api/v1/auth/otp/verify')
      .send({ ...body, code: t.email.codeFor(EMAIL) });

    expect(withRightCode.status).toBe(429);
    expect(withRightCode.body.error.message).toMatch(/today/);
  });

  it('rejects a code after it has been used once', async () => {
    await api().post('/api/v1/auth/otp').send({ email: EMAIL, purpose: 'SIGNUP' });
    const code = t.email.codeFor(EMAIL);
    const body = { email: EMAIL, purpose: 'SIGNUP', code };

    await api().post('/api/v1/auth/otp/verify').send(body).expect(200);
    await api().post('/api/v1/auth/otp/verify').send(body).expect(400);
  });

  it('makes you wait a minute before resending a code', async () => {
    const body = { email: EMAIL, purpose: 'SIGNUP' };
    await api().post('/api/v1/auth/otp').send(body).expect(202);

    const tooSoon = await api().post('/api/v1/auth/otp').send(body);
    t.clock.set(minutesAfter(T0, 1.1));
    const later = await api().post('/api/v1/auth/otp').send(body);

    expect(tooSoon.status).toBe(429);
    expect(Number(tooSoon.headers['retry-after'])).toBeGreaterThan(0);
    expect(later.status).toBe(202);
  });

  it('expires the code after 10 minutes', async () => {
    await api().post('/api/v1/auth/otp').send({ email: EMAIL, purpose: 'SIGNUP' });
    t.clock.set(minutesAfter(T0, 11));

    const res = await api()
      .post('/api/v1/auth/otp/verify')
      .send({ email: EMAIL, purpose: 'SIGNUP', code: t.email.codeFor(EMAIL) });

    expect(res.status).toBe(400);
  });

  it('requires a school of the university', async () => {
    const verificationToken = await verifiedToken(EMAIL, 'SIGNUP');

    const res = await api()
      .post('/api/v1/auth/register')
      .send({ verificationToken, password: PASSWORD, ...profile, school: 'Hogwarts' });

    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual([
      { path: 'body.school', message: 'Choose a school of Rishihood University' },
    ]);
  });

  it('enforces the password policy', async () => {
    const verificationToken = await verifiedToken(EMAIL, 'SIGNUP');

    const res = await api()
      .post('/api/v1/auth/register')
      .send({ verificationToken, password: 'password', ...profile });

    expect(res.status).toBe(400);
    expect(res.body.error.details[0].path).toBe('body.password');
  });

  it('rejects an expired verification token', async () => {
    const verificationToken = await verifiedToken(EMAIL, 'SIGNUP');
    t.clock.set(minutesAfter(T0, 31));

    const res = await api()
      .post('/api/v1/auth/register')
      .send({ verificationToken, password: PASSWORD, ...profile });

    expect(res.status).toBe(401);
  });

  it('does not accept a password-reset verification for sign-up', async () => {
    await signUp();
    const resetToken = await verifiedToken(EMAIL, 'PASSWORD_RESET');

    const res = await api()
      .post('/api/v1/auth/register')
      .send({ verificationToken: resetToken, password: PASSWORD, ...profile });

    expect(res.status).toBe(401);
  });
});

describe('login', () => {
  it('signs in with the right password', async () => {
    await signUp();

    const res = await api()
      .post('/api/v1/auth/login')
      .send({ email: EMAIL.toUpperCase(), password: PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(EMAIL);
    expect(refreshCookie(res)).toMatch(new RegExp(`^${REFRESH_COOKIE}=`));
  });

  it('gives the same answer for a wrong password and an unknown email', async () => {
    await signUp();

    const wrongPassword = await api()
      .post('/api/v1/auth/login')
      .send({ email: EMAIL, password: 'not-it-123' });
    const unknownEmail = await api()
      .post('/api/v1/auth/login')
      .send({ email: 'nobody@rishihood.edu.in', password: PASSWORD });

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(wrongPassword.body.error.message).toBe(unknownEmail.body.error.message);
  });

  it('refuses suspended accounts', async () => {
    await signUp();
    const users = new MongoUserRepository(t.connection);
    const user = await users.findByEmail(EMAIL);
    user!.suspend('Testing', { userId: 'a'.repeat(24), role: 'PLATFORM_ADMIN' }, T0);
    await users.update(user!);

    const res = await api().post('/api/v1/auth/login').send({ email: EMAIL, password: PASSWORD });

    expect(res.status).toBe(403);
  });

  it('never counts successful sign-ins towards the limit', async () => {
    await signUp();
    const { limit } = LOGIN_FAILURE_LIMITS.perAccountAndIp;

    for (let i = 0; i < limit + 2; i++) {
      await api().post('/api/v1/auth/login').send({ email: EMAIL, password: PASSWORD }).expect(200);
    }
  });

  it('slows down password guessing on an account', async () => {
    await signUp();
    const { limit } = LOGIN_FAILURE_LIMITS.perAccountAndIp;

    for (let i = 0; i < limit; i++) {
      await api().post('/api/v1/auth/login').send({ email: EMAIL, password: 'guess-123' });
    }
    const blocked = await api()
      .post('/api/v1/auth/login')
      .send({ email: EMAIL, password: PASSWORD });

    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('RATE_LIMITED');
  });
});

describe('access tokens', () => {
  it('are required for protected routes', async () => {
    expect((await api().get('/api/v1/users/me')).status).toBe(401);
    expect(
      (await api().get('/api/v1/users/me').set('Authorization', 'Bearer not-a-token')).status,
    ).toBe(401);
  });

  it('expire after 15 minutes', async () => {
    const { accessToken } = await signUp();
    t.clock.set(minutesAfter(t.clock.now(), 16));

    const res = await api().get('/api/v1/users/me').set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(401);
  });

  it('cannot be forged by changing the payload', async () => {
    const { accessToken } = await signUp();
    const [header, payload, signature] = accessToken.split('.');
    const claims = JSON.parse(Buffer.from(payload as string, 'base64url').toString());
    const forged = Buffer.from(JSON.stringify({ ...claims, role: 'PLATFORM_ADMIN' })).toString(
      'base64url',
    );

    const res = await api()
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${header}.${forged}.${signature}`);

    expect(res.status).toBe(401);
  });
});

describe('refresh tokens', () => {
  it('are rotated on every refresh', async () => {
    const { cookie } = await signUp();

    const res = await api().post('/api/v1/auth/refresh').set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(refreshCookie(res)).not.toBe(cookie);
  });

  it('end the whole session family when an old token is replayed (theft detection)', async () => {
    const { cookie: stolen } = await signUp();
    const first = await api().post('/api/v1/auth/refresh').set('Cookie', stolen).expect(200);
    const current = refreshCookie(first);
    t.clock.set(minutesAfter(t.clock.now(), 5));

    const replay = await api().post('/api/v1/auth/refresh').set('Cookie', stolen);
    const victim = await api().post('/api/v1/auth/refresh').set('Cookie', current);

    expect(replay.status).toBe(401);
    expect(victim.status).toBe(401);
  });

  it('tolerate two tabs refreshing at almost the same time', async () => {
    const { cookie } = await signUp();
    const first = await api().post('/api/v1/auth/refresh').set('Cookie', cookie).expect(200);

    const secondTab = await api().post('/api/v1/auth/refresh').set('Cookie', cookie);
    const stillValid = await api().post('/api/v1/auth/refresh').set('Cookie', refreshCookie(first));

    expect(secondTab.status).toBe(401);
    expect(stillValid.status).toBe(200);
  });

  it('expire after 7 days', async () => {
    const { cookie } = await signUp();
    t.clock.set(daysAfter(t.clock.now(), 8));

    const res = await api().post('/api/v1/auth/refresh').set('Cookie', cookie);

    expect(res.status).toBe(401);
    expect(res.body.error.message).toMatch(/expired/);
  });

  it('stop working after logout', async () => {
    const { cookie } = await signUp();

    const logout = await api().post('/api/v1/auth/logout').set('Cookie', cookie);
    const refresh = await api().post('/api/v1/auth/refresh').set('Cookie', cookie);

    expect(logout.status).toBe(204);
    expect(([] as string[]).concat(logout.headers['set-cookie'] ?? []).join()).toMatch(
      new RegExp(`${REFRESH_COOKIE}=;`),
    );
    expect(refresh.status).toBe(401);
  });

  it('sign out the whole device even when a refresh races the sign-out (no conflict)', async () => {
    const { cookie: first } = await signUp();
    const rotated = refreshCookie(
      await api().post('/api/v1/auth/refresh').set('Cookie', first).expect(200),
    );

    // The browser signs out while another request is refreshing with the same token.
    const [logout, racingRefresh] = await Promise.all([
      api().post('/api/v1/auth/logout').set('Cookie', rotated),
      api().post('/api/v1/auth/refresh').set('Cookie', rotated),
    ]);

    expect(logout.status).toBe(204);
    expect([200, 401]).toContain(racingRefresh.status);
    // Whatever the race produced, nothing from this sign-in works any more.
    if (racingRefresh.status === 200) {
      const issued = refreshCookie(racingRefresh);
      expect((await api().post('/api/v1/auth/refresh').set('Cookie', issued)).status).toBe(401);
    }
    expect((await api().post('/api/v1/auth/refresh').set('Cookie', rotated)).status).toBe(401);
  });

  it('refuse a signed-out token without raising a theft alarm', async () => {
    const { cookie } = await signUp();
    await api().post('/api/v1/auth/logout').set('Cookie', cookie).expect(204);
    t.clock.set(minutesAfter(t.clock.now(), 5));

    expect((await api().post('/api/v1/auth/refresh').set('Cookie', cookie)).status).toBe(401);

    await t.container.worker.drain();
    const alarms = await t.container.services.audit.findRecent({
      action: 'SESSION_REUSE_DETECTED',
    });
    expect(alarms).toEqual([]);
  });

  it('are required to refresh', async () => {
    expect((await api().post('/api/v1/auth/refresh')).status).toBe(401);
  });
});

describe('password reset', () => {
  it('sets a new password and signs out every device', async () => {
    const { cookie } = await signUp();
    const verificationToken = await verifiedToken(EMAIL, 'PASSWORD_RESET');
    const newPassword = 'a-brand-new-pass-7';

    const reset = await api()
      .post('/api/v1/auth/password/reset')
      .send({ verificationToken, newPassword });

    expect(reset.status).toBe(200);
    expect((await api().post('/api/v1/auth/refresh').set('Cookie', cookie)).status).toBe(401);
    expect(
      (await api().post('/api/v1/auth/login').send({ email: EMAIL, password: PASSWORD })).status,
    ).toBe(401);
    expect(
      (await api().post('/api/v1/auth/login').send({ email: EMAIL, password: newPassword })).status,
    ).toBe(200);
  });

  it('allows each reset verification to be used once', async () => {
    await signUp();
    const verificationToken = await verifiedToken(EMAIL, 'PASSWORD_RESET');
    const body = { verificationToken, newPassword: 'first-new-pass-1' };

    await api().post('/api/v1/auth/password/reset').send(body).expect(200);
    const again = await api()
      .post('/api/v1/auth/password/reset')
      .send({ ...body, newPassword: 'second-new-pass-2' });

    expect(again.status).toBe(401);
  });

  it('answers the same for unknown emails and sends nothing', async () => {
    const res = await api()
      .post('/api/v1/auth/otp')
      .send({ email: 'nobody@rishihood.edu.in', purpose: 'PASSWORD_RESET' });

    expect(res.status).toBe(202);
    expect(t.email.sent).toHaveLength(0);
  });
});

describe('university', () => {
  it('gives signed-in users their university and its schools', async () => {
    const { accessToken } = await signUp();

    const res = await api()
      .get('/api/v1/universities/current')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      name: 'Rishihood University',
      schools: ['Newton School of Technology', 'School of Entrepreneurship'],
    });
    expect((await api().get('/api/v1/universities/current')).status).toBe(401);
  });
});

describe('profile', () => {
  it('updates the signed-in user', async () => {
    const { accessToken } = await signUp();

    const res = await api()
      .patch('/api/v1/users/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ phone: null, school: 'School of Entrepreneurship', year: 3 });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ phone: null, school: 'School of Entrepreneurship', year: 3 });
  });

  it('rejects unknown fields, empty updates and schools of other universities', async () => {
    const { accessToken } = await signUp();
    const patch = (body: object) =>
      api().patch('/api/v1/users/me').set('Authorization', `Bearer ${accessToken}`).send(body);

    expect((await patch({ role: 'PLATFORM_ADMIN' })).status).toBe(400);
    expect((await patch({})).status).toBe(400);
    expect((await patch({ school: 'Hogwarts' })).status).toBe(400);
  });
});
