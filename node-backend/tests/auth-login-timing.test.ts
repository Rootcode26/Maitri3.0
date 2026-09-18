import { describe, expect, it, vi } from 'vitest';

const verifyPassword = vi.fn(async () => false);
const hashPassword = vi.fn(async () => 'dummy-argon2-hash');
vi.mock('../src/modules/auth/password.service.js', () => ({ verifyPassword, hashPassword }));

const { AuthService } = await import('../src/modules/auth/auth.service.js');

type Repo = ConstructorParameters<typeof AuthService>[0];
type Otp = ConstructorParameters<typeof AuthService>[1];

describe('login timing hardening', () => {
  it('performs a password verify even when the phone number is unknown', async () => {
    verifyPassword.mockClear();
    hashPassword.mockClear();
    const repo = { findUserByPhone: vi.fn().mockResolvedValue(null) };
    const service = new AuthService(repo as unknown as Repo, {} as unknown as Otp);

    await expect(
      service.login({ phoneNumber: '+919876543210', password: 'whatever', rememberMe: false }),
    ).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });

    expect(hashPassword).toHaveBeenCalledTimes(1);
    expect(verifyPassword).toHaveBeenCalledTimes(1);
    expect(verifyPassword).toHaveBeenCalledWith('dummy-argon2-hash', 'whatever');
  });

  it('reuses the dummy hash across repeated unknown-account logins', async () => {
    hashPassword.mockClear();
    const repo = { findUserByPhone: vi.fn().mockResolvedValue(null) };
    const service = new AuthService(repo as unknown as Repo, {} as unknown as Otp);
    await service
      .login({ phoneNumber: '+919876543210', password: 'a', rememberMe: false })
      .catch(() => undefined);
    await service
      .login({ phoneNumber: '+919876543211', password: 'b', rememberMe: false })
      .catch(() => undefined);
    expect(hashPassword).not.toHaveBeenCalled();
  });
});
