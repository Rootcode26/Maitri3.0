import { createHash } from 'node:crypto';

import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../../src/app.js';
import { closeRedis, connectRedis, redisClient } from '../../src/cache/redis.js';
import { closeDatabase, connectDatabase, query } from '../../src/database/database.js';
import { verifyAccessToken } from '../../src/modules/auth/token.service.js';

const runE2e = process.env.RUN_E2E === 'true';
const phoneNumber = '+919876540099';
const inspectorPhoneNumber = '+919876540100';
const password = 'e2e-strong-password';
const otp = process.env.OTP_DEVELOPMENT_CODE ?? '123456';
const forwardedIp = '198.51.100.77';

const hashIdentifier = (value: string): string => createHash('sha256').update(value).digest('hex');

const phoneId = hashIdentifier(phoneNumber);
const inspectorPhoneId = hashIdentifier(inspectorPhoneNumber);
const ipId = hashIdentifier(forwardedIp);
const redisKeys = [
  `auth:otp:register:${phoneId}`,
  `auth:otp:attempts:register:${phoneId}`,
  `auth:otp:resend:register:${phoneId}`,
  `auth:otp:send-limit:register:${phoneId}`,
  `auth:otp:send-limit-ip:${ipId}`,
  `auth:otp:password-reset:${phoneId}`,
  `auth:otp:attempts:password-reset:${phoneId}`,
  `auth:otp:resend:password-reset:${phoneId}`,
  `auth:otp:send-limit:password-reset:${phoneId}`,
];
const inspectorRedisKeys = [
  `auth:otp:register:${inspectorPhoneId}`,
  `auth:otp:attempts:register:${inspectorPhoneId}`,
  `auth:otp:resend:register:${inspectorPhoneId}`,
  `auth:otp:send-limit:register:${inspectorPhoneId}`,
  `auth:otp:send-limit-ip:${ipId}`,
];

const cookieValue = (response: request.Response, name: string): string => {
  const cookies = response.headers['set-cookie'] as unknown as string[] | undefined;
  const cookie = cookies?.find((value) => value.startsWith(`${name}=`));
  if (!cookie) throw new Error(`${name} cookie was not returned`);
  return cookie.split(';', 1)[0]!;
};

describe.runIf(runE2e)('authentication end-to-end', () => {
  const app = createApp();
  app.set('trust proxy', 1);
  const agent = request.agent(app);
  const revokedAccessKeys = new Set<string>();

  const cleanTestState = async () => {
    await query('DELETE FROM users WHERE phone_number IN ($1, $2)', [
      phoneNumber,
      inspectorPhoneNumber,
    ]);
    await redisClient.del(...redisKeys, ...inspectorRedisKeys, ...revokedAccessKeys);
  };

  beforeAll(async () => {
    await Promise.all([connectDatabase(), connectRedis()]);
    await cleanTestState();
  });

  afterAll(async () => {
    await cleanTestState();
    await Promise.all([closeDatabase(), closeRedis()]);
  });

  it('completes registration, OTP verification, session rotation, and logout', async () => {
    const registration = await agent
      .post('/api/v1/auth/register')
      .set('X-Forwarded-For', forwardedIp)
      .send({ name: 'E2E Applicant', phoneNumber, password, role: 'applicant', industry: 'steel' });

    expect(registration.status).toBe(201);
    expect(registration.body.data).toMatchObject({
      verificationRequired: true,
      user: { phoneNumber, role: 'applicant', status: 'pending_verification' },
    });
    expect(registration.headers['set-cookie']).toBeUndefined();

    const prematureResend = await agent
      .post('/api/v1/auth/otp/resend')
      .set('X-Forwarded-For', forwardedIp)
      .send({ phoneNumber });
    expect(prematureResend.status).toBe(429);
    expect(prematureResend.body.code).toBe('OTP_RESEND_COOLDOWN');

    const storedBeforeVerification = await query<{
      status: string;
      phone_verified_at: Date | null;
      password_hash: string;
    }>('SELECT status, phone_verified_at, password_hash FROM users WHERE phone_number = $1', [
      phoneNumber,
    ]);
    expect(storedBeforeVerification.rows[0]).toMatchObject({
      status: 'pending_verification',
      phone_verified_at: null,
    });
    expect(storedBeforeVerification.rows[0]?.password_hash).toMatch(/^\$argon2id\$/);

    const loginBeforeVerification = await agent
      .post('/api/v1/auth/login')
      .send({ phoneNumber, password });
    expect(loginBeforeVerification.status).toBe(403);
    expect(loginBeforeVerification.body.code).toBe('ACCOUNT_INACTIVE');

    const wrongOtp = await agent
      .post('/api/v1/auth/otp/verify')
      .set('X-Forwarded-For', forwardedIp)
      .send({ phoneNumber, otp: '000000' });
    expect(wrongOtp.status).toBe(400);
    expect(wrongOtp.body.code).toBe('OTP_INVALID_OR_EXPIRED');

    const verification = await agent
      .post('/api/v1/auth/otp/verify')
      .set('X-Forwarded-For', forwardedIp)
      .send({ phoneNumber, otp });
    expect(verification.status).toBe(200);
    expect(verification.body.data.user.status).toBe('active');

    const wrongWorkspace = await request(app)
      .post('/api/v1/auth/login')
      .send({ phoneNumber, password, expectedRole: 'inspector' });
    expect(wrongWorkspace.status).toBe(403);
    expect(wrongWorkspace.body.code).toBe('WORKSPACE_ACCESS_DENIED');
    expect(wrongWorkspace.headers['set-cookie']).toBeUndefined();
    const originalRefreshCookie = cookieValue(verification, 'refresh_token');
    const originalAccessCookie = cookieValue(verification, 'access_token');
    const originalAccessToken = originalAccessCookie.slice('access_token='.length);
    revokedAccessKeys.add(
      `auth:access-token:revoked:${verifyAccessToken(originalAccessToken).jti}`,
    );

    const storedAfterVerification = await query<{
      status: string;
      phone_verified_at: Date | null;
      refresh_tokens: string;
    }>(
      `SELECT users.status, users.phone_verified_at, COUNT(refresh_tokens.id)::text AS refresh_tokens
       FROM users
       LEFT JOIN refresh_tokens ON refresh_tokens.user_id = users.id
       WHERE users.phone_number = $1
       GROUP BY users.id`,
      [phoneNumber],
    );
    expect(storedAfterVerification.rows[0]?.status).toBe('active');
    expect(storedAfterVerification.rows[0]?.phone_verified_at).toBeInstanceOf(Date);
    expect(storedAfterVerification.rows[0]?.refresh_tokens).toBe('1');
    const storedRefreshToken = await query<{ refresh_token_hash: string }>(
      `SELECT refresh_token_hash FROM refresh_tokens
       WHERE user_id = (SELECT id FROM users WHERE phone_number = $1)`,
      [phoneNumber],
    );
    expect(storedRefreshToken.rows[0]?.refresh_token_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(originalRefreshCookie).not.toContain(storedRefreshToken.rows[0]!.refresh_token_hash);

    const replayedOtp = await request(app)
      .post('/api/v1/auth/otp/verify')
      .set('X-Forwarded-For', forwardedIp)
      .send({ phoneNumber, otp });
    expect(replayedOtp.status).toBe(400);
    expect(replayedOtp.body.code).toBe('OTP_INVALID_OR_EXPIRED');

    const profile = await agent.get('/api/v1/auth/me');
    expect(profile.status).toBe(200);
    expect(profile.body.data.user).toMatchObject({ role: 'applicant' });
    expect(profile.body.data.user).not.toHaveProperty('passwordHash');

    const refresh = await agent.post('/api/v1/auth/refresh');
    expect(refresh.status).toBe(200);
    const rotatedRefreshCookie = cookieValue(refresh, 'refresh_token');
    expect(rotatedRefreshCookie).not.toBe(originalRefreshCookie);
    const rotatedAccessToken = cookieValue(refresh, 'access_token').slice('access_token='.length);
    revokedAccessKeys.add(`auth:access-token:revoked:${verifyAccessToken(rotatedAccessToken).jti}`);

    const rotationState = await query<{ total: string; revoked: string; active: string }>(
      `SELECT COUNT(*)::text AS total,
              COUNT(*) FILTER (WHERE revoked_at IS NOT NULL)::text AS revoked,
              COUNT(*) FILTER (WHERE revoked_at IS NULL)::text AS active
       FROM refresh_tokens
       WHERE user_id = (SELECT id FROM users WHERE phone_number = $1)`,
      [phoneNumber],
    );
    expect(rotationState.rows[0]).toEqual({ total: '2', revoked: '1', active: '1' });

    const reuse = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', originalRefreshCookie);
    expect(reuse.status).toBe(401);
    expect(reuse.body.code).toBe('REFRESH_TOKEN_INVALID');

    const wrongPassword = await request(app)
      .post('/api/v1/auth/login')
      .send({ phoneNumber, password: 'incorrect-password' });
    expect(wrongPassword.status).toBe(401);
    expect(wrongPassword.body.code).toBe('INVALID_CREDENTIALS');

    const logout = await agent.post('/api/v1/auth/logout');
    expect(logout.status).toBe(204);

    const activeAfterLogout = await query<{ active: string }>(
      `SELECT COUNT(*) FILTER (WHERE revoked_at IS NULL)::text AS active
       FROM refresh_tokens
       WHERE user_id = (SELECT id FROM users WHERE phone_number = $1)`,
      [phoneNumber],
    );
    expect(activeAfterLogout.rows[0]?.active).toBe('0');

    const profileAfterLogout = await agent.get('/api/v1/auth/me');
    expect(profileAfterLogout.status).toBe(401);
    expect(profileAfterLogout.body.code).toBe('AUTHENTICATION_REQUIRED');
  });

  it('keeps resend responses generic for unknown phone numbers', async () => {
    const response = await request(app)
      .post('/api/v1/auth/otp/resend')
      .set('X-Forwarded-For', forwardedIp)
      .send({ phoneNumber: '+919876540098' });

    expect(response.status).toBe(202);
    expect(response.body.message).not.toContain('+919876540098');
  });

  it('completes inspector registration, OTP verification, department-scoped login, and logout', async () => {
    const inspectorAgent = request.agent(app);
    const registration = await inspectorAgent
      .post('/api/v1/auth/register')
      .set('X-Forwarded-For', forwardedIp)
      .send({
        name: 'E2E Inspector',
        phoneNumber: inspectorPhoneNumber,
        password: 'e2e-inspector-password',
        role: 'inspector',
        departmentKey: 'mpcb',
      });

    expect(registration.status).toBe(201);
    expect(registration.body.data.user).toMatchObject({
      phoneNumber: inspectorPhoneNumber,
      role: 'inspector',
      status: 'pending_verification',
    });

    const verification = await inspectorAgent
      .post('/api/v1/auth/otp/verify')
      .set('X-Forwarded-For', forwardedIp)
      .send({ phoneNumber: inspectorPhoneNumber, otp });
    expect(verification.status).toBe(200);
    expect(verification.body.data.user).toMatchObject({ role: 'inspector' });
    expect(verification.body.data.user.departmentId).toEqual(expect.any(String));

    const login = await request(app).post('/api/v1/auth/login').send({
      phoneNumber: inspectorPhoneNumber,
      password: 'e2e-inspector-password',
      expectedRole: 'inspector',
    });
    expect(login.status).toBe(200);
    expect(login.body.data.user).toMatchObject({ role: 'inspector' });
    expect(login.body.data.user.departmentId).toBe(verification.body.data.user.departmentId);

    expect((await inspectorAgent.post('/api/v1/auth/logout')).status).toBe(204);
  });

  it('completes forgot-password and reset-password with session revocation', async () => {
    const forgot = await request(app)
      .post('/api/v1/auth/password/forgot')
      .set('X-Forwarded-For', forwardedIp)
      .send({ phoneNumber });
    expect(forgot.status).toBe(202);
    expect(forgot.body.message).not.toContain(phoneNumber);

    const wrongCode = await request(app)
      .post('/api/v1/auth/password/reset')
      .set('X-Forwarded-For', forwardedIp)
      .send({ phoneNumber, otp: '000000', newPassword: 'replacement-password' });
    expect(wrongCode.status).toBe(400);
    expect(wrongCode.body.code).toBe('OTP_INVALID_OR_EXPIRED');

    const reset = await request(app)
      .post('/api/v1/auth/password/reset')
      .set('X-Forwarded-For', forwardedIp)
      .send({ phoneNumber, otp, newPassword: 'replacement-password' });
    expect(reset.status).toBe(200);

    const oldPasswordLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ phoneNumber, password });
    expect(oldPasswordLogin.status).toBe(401);

    const newPasswordLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ phoneNumber, password: 'replacement-password' });
    expect(newPasswordLogin.status).toBe(200);
    expect(newPasswordLogin.headers['set-cookie']).toHaveLength(2);
  });
});
