import { hash } from 'argon2';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppError } from '../src/errors/app-error.js';
import type { AuthRepository } from '../src/modules/auth/auth.repository.js';
import { AuthService } from '../src/modules/auth/auth.service.js';
import type { AuthUser } from '../src/modules/auth/auth.types.js';
import type { OtpService } from '../src/modules/auth/otp.service.js';
import { hashRefreshToken, verifyAccessToken } from '../src/modules/auth/token.service.js';

const user: AuthUser = {
  id: '94a84df4-779f-4e3b-98c3-d5ea23ccc75c',
  name: 'Applicant One',
  phoneNumber: '+919876543210',
  role: 'applicant',
  status: 'active',
  departmentId: null,
  industry: 'steel',
};
const inspector: AuthUser = {
  id: '1646d9be-e193-43bc-8555-4b70b648768a',
  name: 'Inspector One',
  phoneNumber: '+919876543211',
  role: 'inspector',
  status: 'active',
  departmentId: '5de5a920-0df4-45a2-b3d0-a516f2936ef7',
  industry: null,
};

describe('AuthService', () => {
  const repository = {
    findUserById: vi.fn(),
    findUserByPhone: vi.fn(),
    createPendingUser: vi.fn(),
    activatePendingUser: vi.fn(),
    storeRefreshToken: vi.fn(),
    rotateRefreshToken: vi.fn(),
    revokeRefreshToken: vi.fn(),
    updatePassword: vi.fn(),
  };
  const otpService = {
    sendRegistrationOtp: vi.fn(),
    verifyRegistrationOtp: vi.fn(),
    sendPasswordResetOtp: vi.fn(),
    verifyPasswordResetOtp: vi.fn(),
  };
  const service = new AuthService(
    repository as unknown as AuthRepository,
    otpService as unknown as OtpService,
  );

  beforeEach(() => vi.resetAllMocks());

  it('registers a pending applicant with a password hash and sends an OTP', async () => {
    repository.findUserByPhone.mockResolvedValue(null);
    repository.createPendingUser.mockResolvedValue(user);
    otpService.sendRegistrationOtp.mockResolvedValue(undefined);

    const result = await service.register(
      {
        name: user.name,
        phoneNumber: user.phoneNumber!,
        password: 'strong-password',
        role: 'applicant',
        industry: 'steel',
      },
      '127.0.0.1',
    );

    const storedPassword = repository.createPendingUser.mock.calls[0]?.[0]?.passwordHash as string;
    expect(storedPassword).toMatch(/^\$argon2id\$/);
    expect(result).toEqual({ user, verificationRequired: true });
    expect(otpService.sendRegistrationOtp).toHaveBeenCalledWith(
      user.id,
      user.phoneNumber,
      '127.0.0.1',
    );
  });

  it('rejects duplicate phone registration', async () => {
    repository.findUserByPhone.mockResolvedValue({ ...user, passwordHash: 'hash' });

    await expect(
      service.register(
        {
          name: user.name,
          phoneNumber: user.phoneNumber!,
          password: 'strong-password',
          role: 'applicant',
          industry: 'steel',
        },
        '127.0.0.1',
      ),
    ).rejects.toMatchObject({ statusCode: 409, code: 'PHONE_ALREADY_REGISTERED' });
  });

  it('registers an inspector with a department and never assigns applicant industry', async () => {
    repository.findUserByPhone.mockResolvedValue(null);
    repository.createPendingUser.mockResolvedValue(inspector);
    otpService.sendRegistrationOtp.mockResolvedValue(undefined);

    const result = await service.register(
      {
        name: inspector.name,
        phoneNumber: inspector.phoneNumber!,
        password: 'strong-password',
        role: 'inspector',
        departmentKey: 'mpcb',
      },
      '127.0.0.1',
    );

    expect(result.user).toEqual(inspector);
    expect(repository.createPendingUser).toHaveBeenCalledWith(
      expect.objectContaining({
        role: 'inspector',
        departmentKey: 'mpcb',
      }),
    );
    expect(repository.createPendingUser.mock.calls[0]?.[0]).not.toHaveProperty('industry');
  });

  it('does not create a session when OTP delivery cannot be initiated', async () => {
    repository.findUserByPhone.mockResolvedValue(null);
    repository.createPendingUser.mockResolvedValue(user);
    otpService.sendRegistrationOtp.mockRejectedValue(new Error('provider unavailable'));

    await expect(
      service.register(
        {
          name: user.name,
          phoneNumber: user.phoneNumber!,
          password: 'strong-password',
          role: 'applicant',
          industry: 'steel',
        },
        '127.0.0.1',
      ),
    ).rejects.toThrow('provider unavailable');
    expect(repository.storeRefreshToken).not.toHaveBeenCalled();
  });

  it('activates an applicant and creates a session after correct OTP verification', async () => {
    otpService.verifyRegistrationOtp.mockResolvedValue(user.id);
    repository.activatePendingUser.mockResolvedValue(user);
    repository.storeRefreshToken.mockResolvedValue(undefined);

    const result = await service.verifyOtp(
      { phoneNumber: user.phoneNumber!, otp: '123456' },
      '127.0.0.1',
    );

    expect(repository.activatePendingUser).toHaveBeenCalledWith(user.id, user.phoneNumber);
    expect(verifyAccessToken(result.accessToken)).toMatchObject({
      userId: user.id,
      role: 'applicant',
      departmentId: null,
      jti: expect.any(String),
      exp: expect.any(Number),
    });
  });

  it('activates an inspector and carries the department into the access token', async () => {
    otpService.verifyRegistrationOtp.mockResolvedValue(inspector.id);
    repository.activatePendingUser.mockResolvedValue(inspector);
    repository.storeRefreshToken.mockResolvedValue(undefined);

    const result = await service.verifyOtp(
      { phoneNumber: inspector.phoneNumber!, otp: '123456' },
      '127.0.0.1',
    );

    expect(result.user).toEqual(inspector);
    expect(verifyAccessToken(result.accessToken)).toMatchObject({
      userId: inspector.id,
      role: 'inspector',
      departmentId: inspector.departmentId,
    });
  });

  it('resends OTP for any pending applicant or inspector', async () => {
    repository.findUserByPhone.mockResolvedValue({
      ...user,
      status: 'pending_verification',
      passwordHash: 'hash',
    });
    await service.resendOtp(user.phoneNumber!, '127.0.0.1');
    expect(otpService.sendRegistrationOtp).toHaveBeenCalledWith(
      user.id,
      user.phoneNumber,
      '127.0.0.1',
    );

    otpService.sendRegistrationOtp.mockClear();
    repository.findUserByPhone.mockResolvedValue({ ...user, passwordHash: 'hash' });
    await service.resendOtp(user.phoneNumber!, '127.0.0.1');
    expect(otpService.sendRegistrationOtp).not.toHaveBeenCalled();

    otpService.sendRegistrationOtp.mockClear();
    repository.findUserByPhone.mockResolvedValue({
      ...inspector,
      status: 'pending_verification',
      passwordHash: 'hash',
    });
    await service.resendOtp(inspector.phoneNumber!, '127.0.0.1');
    expect(otpService.sendRegistrationOtp).toHaveBeenCalledWith(
      inspector.id,
      inspector.phoneNumber,
      '127.0.0.1',
    );
  });

  it('does not activate or issue tokens when OTP verification fails', async () => {
    otpService.verifyRegistrationOtp.mockRejectedValue(
      new AppError('Invalid verification code', {
        statusCode: 400,
        code: 'OTP_INVALID_OR_EXPIRED',
      }),
    );

    await expect(
      service.verifyOtp({ phoneNumber: user.phoneNumber!, otp: '000000' }, '127.0.0.1'),
    ).rejects.toMatchObject({ code: 'OTP_INVALID_OR_EXPIRED' });
    expect(repository.activatePendingUser).not.toHaveBeenCalled();
    expect(repository.storeRefreshToken).not.toHaveBeenCalled();
  });

  it('logs in an active password user without exposing the password hash', async () => {
    const passwordHash = await hash('strong-password');
    repository.findUserByPhone.mockResolvedValue({ ...user, passwordHash });
    repository.storeRefreshToken.mockResolvedValue(undefined);

    const result = await service.login({
      phoneNumber: user.phoneNumber!,
      password: 'strong-password',
      rememberMe: false,
    });

    expect(result.user).toEqual(user);
    expect(result.user).not.toHaveProperty('passwordHash');
  });

  it('uses the same generic error for an unknown user and a wrong password', async () => {
    repository.findUserByPhone.mockResolvedValue(null);
    await expect(
      service.login({
        phoneNumber: user.phoneNumber!,
        password: 'wrong-password',
        rememberMe: false,
      }),
    ).rejects.toMatchObject({ statusCode: 401, code: 'INVALID_CREDENTIALS' });

    repository.findUserByPhone.mockResolvedValue({ ...user, passwordHash: await hash('correct') });
    await expect(
      service.login({
        phoneNumber: user.phoneNumber!,
        password: 'wrong-password',
        rememberMe: false,
      }),
    ).rejects.toMatchObject({ statusCode: 401, code: 'INVALID_CREDENTIALS' });
  });

  it('rejects login for a non-active account', async () => {
    repository.findUserByPhone.mockResolvedValue({
      ...user,
      status: 'suspended',
      passwordHash: await hash('strong-password'),
    });

    await expect(
      service.login({
        phoneNumber: user.phoneNumber!,
        password: 'strong-password',
        rememberMe: false,
      }),
    ).rejects.toMatchObject({ statusCode: 403, code: 'ACCOUNT_INACTIVE' });
  });

  it('rejects valid credentials used for the wrong workspace without creating a session', async () => {
    repository.findUserByPhone.mockResolvedValue({
      ...user,
      passwordHash: await hash('strong-password'),
    });

    await expect(
      service.login({
        phoneNumber: user.phoneNumber!,
        password: 'strong-password',
        rememberMe: false,
        expectedRole: 'inspector',
      }),
    ).rejects.toMatchObject({ statusCode: 403, code: 'WORKSPACE_ACCESS_DENIED' });
    expect(repository.storeRefreshToken).not.toHaveBeenCalled();
  });

  it('rotates a refresh token and rejects its reuse', async () => {
    repository.storeRefreshToken.mockResolvedValue(undefined);
    repository.findUserByPhone.mockResolvedValue({
      ...user,
      passwordHash: await hash('strong-password'),
    });
    const login = await service.login({
      phoneNumber: user.phoneNumber!,
      password: 'strong-password',
      rememberMe: false,
    });
    repository.rotateRefreshToken.mockResolvedValueOnce(user).mockResolvedValueOnce(null);

    const rotated = await service.refresh(login.refreshToken);
    expect(rotated.refreshToken).not.toBe(login.refreshToken);
    expect(repository.rotateRefreshToken).toHaveBeenCalledWith(
      hashRefreshToken(login.refreshToken),
      hashRefreshToken(rotated.refreshToken),
      expect.any(Date),
    );

    await expect(service.refresh(login.refreshToken)).rejects.toBeInstanceOf(AppError);
    await expect(service.refresh(login.refreshToken)).rejects.toMatchObject({
      code: 'REFRESH_TOKEN_INVALID',
    });
  });

  it('revokes a stored refresh token during logout', async () => {
    await service.logout('refresh-token');
    expect(repository.revokeRefreshToken).toHaveBeenCalledWith(hashRefreshToken('refresh-token'));
  });

  it('keeps logout idempotent when no refresh token is supplied', async () => {
    await service.logout(undefined);
    expect(repository.revokeRefreshToken).not.toHaveBeenCalled();
  });

  it('loads the complete active user for session restoration', async () => {
    repository.findUserById.mockResolvedValue(user);
    await expect(service.getCurrentUser(user.id)).resolves.toEqual(user);
    expect(repository.findUserById).toHaveBeenCalledWith(user.id);
  });

  it('rejects deleted and inactive users during session restoration', async () => {
    repository.findUserById
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ ...user, status: 'suspended' });
    await expect(service.getCurrentUser(user.id)).rejects.toMatchObject({
      statusCode: 401,
      code: 'SESSION_INVALID',
    });
    await expect(service.getCurrentUser(user.id)).rejects.toMatchObject({
      statusCode: 403,
      code: 'ACCOUNT_INACTIVE',
    });
  });

  it('creates a 30-day refresh session when remember me is enabled', async () => {
    repository.findUserByPhone.mockResolvedValue({
      ...user,
      passwordHash: await hash('strong-password'),
    });
    repository.storeRefreshToken.mockResolvedValue(undefined);

    const result = await service.login({
      phoneNumber: user.phoneNumber!,
      password: 'strong-password',
      rememberMe: true,
    });

    expect(result.refreshTtlSeconds).toBe(2_592_000);
    expect(repository.storeRefreshToken).toHaveBeenCalledWith(
      user.id,
      expect.any(String),
      expect.any(Date),
    );
  });

  it('sends password reset OTP only for an eligible active account', async () => {
    repository.findUserByPhone.mockResolvedValue({ ...user, passwordHash: 'hash' });
    await service.forgotPassword(user.phoneNumber!, '127.0.0.1');
    expect(otpService.sendPasswordResetOtp).toHaveBeenCalledWith(
      user.id,
      user.phoneNumber,
      '127.0.0.1',
    );

    otpService.sendPasswordResetOtp.mockClear();
    repository.findUserByPhone.mockResolvedValue(null);
    await service.forgotPassword(user.phoneNumber!, '127.0.0.1');
    expect(otpService.sendPasswordResetOtp).not.toHaveBeenCalled();
  });

  it('does not send password reset OTP for an inactive account or account without password', async () => {
    repository.findUserByPhone.mockResolvedValue({
      ...user,
      status: 'suspended',
      passwordHash: 'hash',
    });
    await service.forgotPassword(user.phoneNumber!, '127.0.0.1');
    repository.findUserByPhone.mockResolvedValue({ ...user, passwordHash: null });
    await service.forgotPassword(user.phoneNumber!, '127.0.0.1');
    expect(otpService.sendPasswordResetOtp).not.toHaveBeenCalled();
  });

  it('resets the password with an Argon2 hash after OTP verification', async () => {
    otpService.verifyPasswordResetOtp.mockResolvedValue(user.id);
    repository.updatePassword.mockResolvedValue(true);

    await service.resetPassword(
      {
        phoneNumber: user.phoneNumber!,
        otp: '123456',
        newPassword: 'new-strong-password',
      },
      '127.0.0.1',
    );

    const storedHash = repository.updatePassword.mock.calls[0]?.[2] as string;
    expect(storedHash).toMatch(/^\$argon2id\$/);
    expect(repository.updatePassword).toHaveBeenCalledWith(user.id, user.phoneNumber, storedHash);
  });

  it('does not update a password when reset OTP verification fails', async () => {
    otpService.verifyPasswordResetOtp.mockRejectedValue(
      new AppError('Invalid verification code', {
        statusCode: 400,
        code: 'OTP_INVALID_OR_EXPIRED',
      }),
    );

    await expect(
      service.resetPassword(
        {
          phoneNumber: user.phoneNumber!,
          otp: '000000',
          newPassword: 'new-strong-password',
        },
        '127.0.0.1',
      ),
    ).rejects.toMatchObject({ code: 'OTP_INVALID_OR_EXPIRED' });
    expect(repository.updatePassword).not.toHaveBeenCalled();
  });

  it('rejects a reset if the verified user can no longer be updated', async () => {
    otpService.verifyPasswordResetOtp.mockResolvedValue(user.id);
    repository.updatePassword.mockResolvedValue(false);

    await expect(
      service.resetPassword(
        {
          phoneNumber: user.phoneNumber!,
          otp: '123456',
          newPassword: 'new-strong-password',
        },
        '127.0.0.1',
      ),
    ).rejects.toMatchObject({ statusCode: 409 });
  });
});
