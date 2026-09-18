import { DatabaseError } from 'pg';
import { describe, expect, it, vi } from 'vitest';

import type { AuthRepository } from '../src/modules/auth/auth.repository.js';
import { AuthService } from '../src/modules/auth/auth.service.js';
import type { OtpService } from '../src/modules/auth/otp.service.js';
import { hashPassword } from '../src/modules/auth/password.service.js';
import {
  hashRefreshToken,
  issueAccessToken,
  issueRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
} from '../src/modules/auth/token.service.js';
import type { AuthUser } from '../src/modules/auth/auth.types.js';

const activeUser: AuthUser = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Applicant One',
  phoneNumber: '+919876543210',
  role: 'applicant',
  status: 'active',
  departmentId: null,
  industry: 'food',
};

const makeService = (repo: Partial<AuthRepository>, otp: Partial<OtpService> = {}) =>
  new AuthService(repo as AuthRepository, otp as OtpService);

describe('token.service (real crypto)', () => {
  it('round-trips an access token and preserves the department claim', () => {
    const token = issueAccessToken('user-1', 'inspector', 'dept-9');
    const claims = verifyAccessToken(token);
    expect(claims).toMatchObject({ userId: 'user-1', role: 'inspector', departmentId: 'dept-9' });
    expect(typeof claims.jti).toBe('string');
  });

  it('rejects a refresh token presented as an access token (tokenType guard)', () => {
    const refresh = issueRefreshToken('user-1', 'applicant', true);
    expect(() => verifyAccessToken(refresh)).toThrow();
  });

  it('rejects an access token presented as a refresh token', () => {
    const access = issueAccessToken('user-1', 'applicant');
    expect(() => verifyRefreshToken(access)).toThrow();
  });

  it('preserves the remembered flag through a refresh token', () => {
    expect(verifyRefreshToken(issueRefreshToken('u', 'applicant', true)).remembered).toBe(true);
    expect(verifyRefreshToken(issueRefreshToken('u', 'applicant', false)).remembered).toBe(false);
  });

  it('rejects a tampered token', () => {
    const token = issueAccessToken('user-1', 'applicant');
    expect(() => verifyAccessToken(`${token}tamper`)).toThrow();
  });

  it('hashes refresh tokens deterministically and distinctly', () => {
    expect(hashRefreshToken('abc')).toBe(hashRefreshToken('abc'));
    expect(hashRefreshToken('abc')).not.toBe(hashRefreshToken('abd'));
  });
});

describe('AuthService.login', () => {
  it('rejects an unknown phone number as invalid credentials', async () => {
    const service = makeService({ findUserByPhone: vi.fn().mockResolvedValue(null) });
    await expect(
      service.login({
        phoneNumber: activeUser.phoneNumber!,
        password: 'whatever',
        rememberMe: false,
      }),
    ).rejects.toMatchObject({ statusCode: 401, code: 'INVALID_CREDENTIALS' });
  });

  it('rejects a wrong password as invalid credentials', async () => {
    const passwordHash = await hashPassword('correct-horse');
    const service = makeService({
      findUserByPhone: vi.fn().mockResolvedValue({ ...activeUser, passwordHash }),
    });
    await expect(
      service.login({
        phoneNumber: activeUser.phoneNumber!,
        password: 'wrong-password',
        rememberMe: false,
      }),
    ).rejects.toMatchObject({ statusCode: 401, code: 'INVALID_CREDENTIALS' });
  });

  it('refuses a non-active account', async () => {
    const passwordHash = await hashPassword('correct-horse');
    const service = makeService({
      findUserByPhone: vi
        .fn()
        .mockResolvedValue({ ...activeUser, status: 'pending_verification', passwordHash }),
    });
    await expect(
      service.login({
        phoneNumber: activeUser.phoneNumber!,
        password: 'correct-horse',
        rememberMe: false,
      }),
    ).rejects.toMatchObject({ statusCode: 403, code: 'ACCOUNT_INACTIVE' });
  });

  it('refuses a workspace the account cannot access', async () => {
    const passwordHash = await hashPassword('correct-horse');
    const service = makeService({
      findUserByPhone: vi.fn().mockResolvedValue({ ...activeUser, passwordHash }),
      storeRefreshToken: vi.fn().mockResolvedValue(undefined),
    });
    await expect(
      service.login({
        phoneNumber: activeUser.phoneNumber!,
        password: 'correct-horse',
        rememberMe: false,
        expectedRole: 'inspector',
      }),
    ).rejects.toMatchObject({ statusCode: 403, code: 'WORKSPACE_ACCESS_DENIED' });
  });

  it('issues a session with a verifiable access token on success', async () => {
    const passwordHash = await hashPassword('correct-horse');
    const storeRefreshToken = vi.fn().mockResolvedValue(undefined);
    const service = makeService({
      findUserByPhone: vi.fn().mockResolvedValue({ ...activeUser, passwordHash }),
      storeRefreshToken,
    });
    const result = await service.login({
      phoneNumber: activeUser.phoneNumber!,
      password: 'correct-horse',
      rememberMe: true,
    });
    expect(verifyAccessToken(result.accessToken).userId).toBe(activeUser.id);
    expect(verifyRefreshToken(result.refreshToken).remembered).toBe(true);
    expect(storeRefreshToken).toHaveBeenCalledWith(
      activeUser.id,
      hashRefreshToken(result.refreshToken),
      expect.any(Date),
    );
  });
});

describe('AuthService.register', () => {
  it('rejects a phone number that already exists (pre-check)', async () => {
    const service = makeService({ findUserByPhone: vi.fn().mockResolvedValue(activeUser) });
    await expect(
      service.register(
        {
          role: 'applicant',
          name: 'X',
          phoneNumber: activeUser.phoneNumber!,
          password: 'password12',
          industry: 'food',
        },
        '1.2.3.4',
      ),
    ).rejects.toMatchObject({ statusCode: 409, code: 'PHONE_ALREADY_REGISTERED' });
  });

  it('maps a unique-violation race (23505) to a conflict', async () => {
    const dbError = Object.assign(new DatabaseError('dup', 0, 'error'), { code: '23505' });
    const service = makeService({
      findUserByPhone: vi.fn().mockResolvedValue(null),
      createPendingUser: vi.fn().mockRejectedValue(dbError),
    });
    await expect(
      service.register(
        {
          role: 'applicant',
          name: 'X',
          phoneNumber: activeUser.phoneNumber!,
          password: 'password12',
          industry: 'food',
        },
        '1.2.3.4',
      ),
    ).rejects.toMatchObject({ statusCode: 409, code: 'PHONE_ALREADY_REGISTERED' });
  });

  it('sends a registration OTP on success', async () => {
    const sendRegistrationOtp = vi.fn().mockResolvedValue(undefined);
    const service = makeService(
      {
        findUserByPhone: vi.fn().mockResolvedValue(null),
        createPendingUser: vi.fn().mockResolvedValue(activeUser),
      },
      { sendRegistrationOtp },
    );
    const result = await service.register(
      {
        role: 'applicant',
        name: 'X',
        phoneNumber: activeUser.phoneNumber!,
        password: 'password12',
        industry: 'food',
      },
      '1.2.3.4',
    );
    expect(result.verificationRequired).toBe(true);
    expect(sendRegistrationOtp).toHaveBeenCalledWith(
      activeUser.id,
      activeUser.phoneNumber,
      '1.2.3.4',
    );
  });
});

describe('AuthService conflict and session paths', () => {
  it('reports a conflict when OTP verify cannot activate the account', async () => {
    const service = makeService(
      { activatePendingUser: vi.fn().mockResolvedValue(null) },
      { verifyRegistrationOtp: vi.fn().mockResolvedValue('user-1') },
    );
    await expect(
      service.verifyOtp({ phoneNumber: activeUser.phoneNumber!, otp: '123456' }, '1.2.3.4'),
    ).rejects.toMatchObject({ statusCode: 409, code: 'OTP_VERIFICATION_CONFLICT' });
  });

  it('reports a conflict when a password reset cannot be applied', async () => {
    const service = makeService(
      { updatePassword: vi.fn().mockResolvedValue(false) },
      { verifyPasswordResetOtp: vi.fn().mockResolvedValue('user-1') },
    );
    await expect(
      service.resetPassword(
        { phoneNumber: activeUser.phoneNumber!, otp: '123456', newPassword: 'password12' },
        '1.2.3.4',
      ),
    ).rejects.toMatchObject({ statusCode: 409, code: 'PASSWORD_RESET_CONFLICT' });
  });

  it('rejects a refresh token that has already been rotated away', async () => {
    const token = issueRefreshToken(activeUser.id, 'applicant', false);
    const service = makeService({ rotateRefreshToken: vi.fn().mockResolvedValue(null) });
    await expect(service.refresh(token)).rejects.toMatchObject({
      statusCode: 401,
      code: 'REFRESH_TOKEN_INVALID',
    });
  });

  it('rotates a valid refresh token into a fresh session', async () => {
    const token = issueRefreshToken(activeUser.id, 'applicant', false);
    const rotateRefreshToken = vi.fn().mockResolvedValue(activeUser);
    const service = makeService({ rotateRefreshToken });
    const result = await service.refresh(token);
    expect(verifyAccessToken(result.accessToken).userId).toBe(activeUser.id);
    expect(result.refreshToken).not.toBe(token);
  });

  it('invalidates the session when the current user no longer exists', async () => {
    const service = makeService({ findUserById: vi.fn().mockResolvedValue(null) });
    await expect(service.getCurrentUser('user-1')).rejects.toMatchObject({
      statusCode: 401,
      code: 'SESSION_INVALID',
    });
  });

  it('blocks a suspended account from resolving the current user', async () => {
    const service = makeService({
      findUserById: vi.fn().mockResolvedValue({ ...activeUser, status: 'suspended' }),
    });
    await expect(service.getCurrentUser('user-1')).rejects.toMatchObject({
      statusCode: 403,
      code: 'ACCOUNT_INACTIVE',
    });
  });
});
