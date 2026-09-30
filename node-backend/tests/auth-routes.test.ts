import cookieParser from 'cookie-parser';
import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { errorHandler } from '../src/middleware/error-handler.js';
import { AuthController } from '../src/modules/auth/auth.controller.js';
import { createAuthRouter } from '../src/modules/auth/auth.routes.js';
import type { AuthService } from '../src/modules/auth/auth.service.js';
import type { AuthResult } from '../src/modules/auth/auth.types.js';
import { issueAccessToken } from '../src/modules/auth/token.service.js';

vi.mock('../src/modules/auth/access-token-store.js', () => ({
  isAccessTokenRevoked: vi.fn().mockResolvedValue(false),
  revokeAccessToken: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../src/cache/redis.js', () => ({
  redisClient: {
    multi: () => ({
      incr: () => ({
        expire: () => ({
          exec: async () => [[null, 1]],
        }),
      }),
    }),
  },
}));

const authResult: AuthResult = {
  user: {
    id: '94a84df4-779f-4e3b-98c3-d5ea23ccc75c',
    name: 'Applicant One',
    phoneNumber: '+919876543210',
    role: 'applicant',
    status: 'active',
    departmentId: null,
    industry: 'steel',
  },
  accessToken: 'access-token-value',
  refreshToken: 'refresh-token-value',
  refreshTtlSeconds: 604_800,
};

const createTestApp = () => {
  const service = {
    register: vi.fn().mockResolvedValue({ user: authResult.user, verificationRequired: true }),
    verifyOtp: vi.fn().mockResolvedValue(authResult),
    resendOtp: vi.fn().mockResolvedValue(undefined),
    forgotPassword: vi.fn().mockResolvedValue(undefined),
    resetPassword: vi.fn().mockResolvedValue(undefined),
    login: vi.fn().mockResolvedValue(authResult),
    refresh: vi.fn().mockResolvedValue(authResult),
    logout: vi.fn().mockResolvedValue(undefined),
    getCurrentUser: vi.fn().mockResolvedValue(authResult.user),
  };
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/v1/auth', createAuthRouter(new AuthController(service as unknown as AuthService)));
  app.use(errorHandler);
  return { app, service };
};

describe('authentication routes', () => {
  it('returns the complete current user without exposing JWT metadata', async () => {
    const { app, service } = createTestApp();
    const token = issueAccessToken(authResult.user.id, authResult.user.role, null);
    const response = await request(app)
      .get('/api/v1/auth/me')
      .set('Cookie', `access_token=${token}`);

    expect(response.status).toBe(200);
    expect(response.body.data.user).toEqual(authResult.user);
    expect(response.body.data.user).not.toHaveProperty('jti');
    expect(service.getCurrentUser).toHaveBeenCalledWith(authResult.user.id);
  });

  it('registers an applicant pending OTP verification and clears any prior session', async () => {
    const { app, service } = createTestApp();
    const response = await request(app)
      .post('/api/v1/auth/register')
      .set('Cookie', 'access_token=stale-access; refresh_token=stale-refresh')
      .send({
        name: 'Applicant One',
        phoneNumber: '+919876543210',
        password: 'strong-password',
        role: 'applicant',
        industry: 'steel',
      });

    expect(response.status).toBe(201);
    expect(response.body.data).toEqual({ user: authResult.user, verificationRequired: true });
    // No session is issued, and any cookie the browser already held is expired so
    // a stale login can never masquerade as the freshly-registered (unverified) user.
    const cookies = (response.headers['set-cookie'] as unknown as string[]) ?? [];
    expect(cookies.some((cookie) => /access_token=[^;]/.test(cookie))).toBe(false);
    expect(cookies.some((cookie) => /refresh_token=[^;]/.test(cookie))).toBe(false);
    expect(cookies.some((cookie) => cookie.startsWith('access_token=;'))).toBe(true);
    expect(cookies.some((cookie) => cookie.startsWith('refresh_token=;'))).toBe(true);
    expect(service.register).toHaveBeenCalledOnce();
  });

  it('rejects inspector registration — inspectors are provisioned, not self-registered', async () => {
    const { app, service } = createTestApp();
    const response = await request(app).post('/api/v1/auth/register').send({
      name: 'Inspector One',
      phoneNumber: '+919876543211',
      password: 'strong-password',
      role: 'inspector',
      departmentKey: 'mpcb',
    });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('VALIDATION_ERROR');
    expect(service.register).not.toHaveBeenCalled();
  });

  it('verifies an OTP and issues HTTP-only development cookies', async () => {
    const { app, service } = createTestApp();
    const response = await request(app)
      .post('/api/v1/auth/otp/verify')
      .send({ phoneNumber: '+919876543210', otp: '123456' });

    expect(response.status).toBe(200);
    expect(service.verifyOtp).toHaveBeenCalledWith(
      { phoneNumber: '+919876543210', otp: '123456' },
      expect.any(String),
    );
    for (const cookie of response.headers['set-cookie'] as unknown as string[]) {
      expect(cookie).toContain('HttpOnly');
      expect(cookie).toContain('SameSite=Lax');
      expect(cookie).not.toContain('Secure');
    }
  });

  it('returns a generic response when resending an OTP', async () => {
    const { app, service } = createTestApp();
    const response = await request(app)
      .post('/api/v1/auth/otp/resend')
      .send({ phoneNumber: '+919876543210' });

    expect(response.status).toBe(202);
    expect(response.body.message).not.toContain('+919876543210');
    expect(service.resendOtp).toHaveBeenCalledOnce();
  });

  it('rejects an invalid registration body before calling the service', async () => {
    const { app, service } = createTestApp();
    const response = await request(app)
      .post('/api/v1/auth/register')
      .send({ name: '', phoneNumber: '9876543210', password: 'short' });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('VALIDATION_ERROR');
    expect(service.register).not.toHaveBeenCalled();
  });

  it.each([
    [{ phoneNumber: '+911234567890', password: 'strong-password' }, 'login'],
    [{ phoneNumber: '+919876543210', otp: '12ab56' }, 'otp/verify'],
    [{}, 'otp/resend'],
  ])('rejects malformed or unexpected request data for %s', async (body, route) => {
    const { app, service } = createTestApp();
    const response = await request(app).post(`/api/v1/auth/${route}`).send(body);

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('VALIDATION_ERROR');
    expect(service.login).not.toHaveBeenCalled();
    expect(service.verifyOtp).not.toHaveBeenCalled();
    expect(service.resendOtp).not.toHaveBeenCalled();
  });

  it('issues authentication cookies after a valid password login', async () => {
    const { app, service } = createTestApp();
    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({ phoneNumber: '+919876543210', password: 'strong-password' });

    expect(response.status).toBe(200);
    expect(service.login).toHaveBeenCalledWith({
      phoneNumber: '+919876543210',
      password: 'strong-password',
      rememberMe: false,
    });
    expect(response.body.data.user).toEqual(authResult.user);
    expect(response.body.data).not.toHaveProperty('accessToken');
    expect(response.body.data).not.toHaveProperty('refreshToken');
    expect(response.headers['set-cookie']).toHaveLength(2);
  });

  it('passes remember-me intent through validated login input', async () => {
    const { app, service } = createTestApp();
    const response = await request(app).post('/api/v1/auth/login').send({
      phoneNumber: '+919876543210',
      password: 'strong-password',
      rememberMe: true,
    });

    expect(response.status).toBe(200);
    expect(service.login).toHaveBeenCalledWith(expect.objectContaining({ rememberMe: true }));
  });

  it('passes the selected workspace role through validated login input', async () => {
    const { app, service } = createTestApp();
    const response = await request(app).post('/api/v1/auth/login').send({
      phoneNumber: '+919876543210',
      password: 'strong-password',
      expectedRole: 'inspector',
    });

    expect(response.status).toBe(200);
    expect(service.login).toHaveBeenCalledWith(
      expect.objectContaining({ expectedRole: 'inspector' }),
    );
  });

  it('returns a generic forgot-password response', async () => {
    const { app, service } = createTestApp();
    const response = await request(app)
      .post('/api/v1/auth/password/forgot')
      .send({ phoneNumber: '+919876543210' });

    expect(response.status).toBe(202);
    expect(response.body.message).not.toContain('+919876543210');
    expect(service.forgotPassword).toHaveBeenCalledWith('+919876543210', expect.any(String));
  });

  it.each([
    ['/password/forgot', { phoneNumber: '9876543210' }],
    [
      '/password/reset',
      { phoneNumber: '+919876543210', otp: '123', newPassword: 'strong-password' },
    ],
    ['/password/reset', { phoneNumber: '+919876543210', otp: '123456', newPassword: 'short' }],
  ])('rejects invalid recovery input for %s', async (route, body) => {
    const { app, service } = createTestApp();
    const response = await request(app).post(`/api/v1/auth${route}`).send(body);

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('VALIDATION_ERROR');
    expect(service.forgotPassword).not.toHaveBeenCalled();
    expect(service.resetPassword).not.toHaveBeenCalled();
  });

  it('validates and completes a password reset while clearing old cookies', async () => {
    const { app, service } = createTestApp();
    const response = await request(app).post('/api/v1/auth/password/reset').send({
      phoneNumber: '+919876543210',
      otp: '123456',
      newPassword: 'new-strong-password',
    });

    expect(response.status).toBe(200);
    expect(service.resetPassword).toHaveBeenCalledWith(
      {
        phoneNumber: '+919876543210',
        otp: '123456',
        newPassword: 'new-strong-password',
      },
      expect.any(String),
    );
    expect(response.headers['set-cookie']).toHaveLength(2);
    expect(response.headers['set-cookie']).toEqual([
      expect.stringContaining('access_token='),
      expect.stringContaining('refresh_token='),
    ]);
  });

  it('does not leak refresh or access tokens in authentication response bodies', async () => {
    const { app } = createTestApp();
    for (const response of [
      await request(app)
        .post('/api/v1/auth/login')
        .send({ phoneNumber: '+919876543210', password: 'strong-password' }),
      await request(app)
        .post('/api/v1/auth/otp/verify')
        .send({ phoneNumber: '+919876543210', otp: '123456' }),
      await request(app).post('/api/v1/auth/refresh').set('Cookie', 'refresh_token=valid-token'),
    ]) {
      expect(response.status).toBe(200);
      expect(JSON.stringify(response.body)).not.toContain('access-token-value');
      expect(JSON.stringify(response.body)).not.toContain('refresh-token-value');
    }
  });

  it('requires the refresh-token cookie', async () => {
    const { app, service } = createTestApp();
    const response = await request(app).post('/api/v1/auth/refresh');

    expect(response.status).toBe(401);
    expect(response.body.code).toBe('REFRESH_TOKEN_REQUIRED');
    expect(service.refresh).not.toHaveBeenCalled();
  });

  it('passes the refresh cookie to rotation and replaces both cookies', async () => {
    const { app, service } = createTestApp();
    const response = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', 'refresh_token=old-refresh-token');

    expect(response.status).toBe(200);
    expect(service.refresh).toHaveBeenCalledWith('old-refresh-token');
    expect(response.headers['set-cookie']).toHaveLength(2);
  });

  it('makes logout idempotent and clears both cookies', async () => {
    const { app, service } = createTestApp();
    const response = await request(app).post('/api/v1/auth/logout');

    expect(response.status).toBe(204);
    expect(service.logout).toHaveBeenCalledWith(undefined);
    expect(response.headers['set-cookie']).toEqual([
      expect.stringContaining('access_token='),
      expect.stringContaining('refresh_token='),
    ]);
  });

  it('forwards the refresh token to logout without returning a response body', async () => {
    const { app, service } = createTestApp();
    const response = await request(app)
      .post('/api/v1/auth/logout')
      .set('Cookie', 'refresh_token=session-to-revoke');

    expect(response.status).toBe(204);
    expect(response.text).toBe('');
    expect(service.logout).toHaveBeenCalledWith('session-to-revoke');
  });
});
