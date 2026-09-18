import { beforeEach, describe, expect, it, vi } from 'vitest';

const redis = vi.hoisted(() => {
  const values = new Map<string, string>();
  const counters = new Map<string, number>();

  const set = vi.fn(async (key: string, value: string, ...args: string[]) => {
    if (args.includes('NX') && values.has(key)) return null;
    values.set(key, value);
    return 'OK';
  });
  const get = vi.fn(async (key: string) => values.get(key) ?? null);
  const del = vi.fn(async (...keys: string[]) => {
    let deleted = 0;
    for (const key of keys) {
      if (values.delete(key)) deleted += 1;
      counters.delete(key);
    }
    return deleted;
  });
  const multi = vi.fn(() => {
    const operations: Array<() => unknown> = [];
    const chain = {
      incr(key: string) {
        operations.push(() => {
          const count = (counters.get(key) ?? 0) + 1;
          counters.set(key, count);
          return count;
        });
        return chain;
      },
      expire() {
        operations.push(() => 1);
        return chain;
      },
      set(key: string, value: string) {
        operations.push(() => {
          values.set(key, value);
          return 'OK';
        });
        return chain;
      },
      del(...keys: string[]) {
        operations.push(() => {
          for (const key of keys) {
            values.delete(key);
            counters.delete(key);
          }
          return keys.length;
        });
        return chain;
      },
      async exec() {
        return operations.map((operation) => [null, operation()]);
      },
    };
    return chain;
  });

  return { values, counters, set, get, del, multi };
});

vi.mock('../src/cache/redis.js', () => ({
  redisClient: {
    set: redis.set,
    get: redis.get,
    del: redis.del,
    multi: redis.multi,
  },
}));

const { OtpService } = await import('../src/modules/auth/otp.service.js');
const { env } = await import('../src/config/env.js');

const clearCooldowns = () => {
  for (const key of [...redis.values.keys()]) {
    if (key.includes('auth:otp:resend:')) redis.values.delete(key);
  }
};

describe('OtpService', () => {
  const provider = { send: vi.fn() };
  const service = new OtpService(provider);
  const phoneNumber = '+919876543210';
  const ipAddress = '127.0.0.1';

  beforeEach(() => {
    redis.values.clear();
    redis.counters.clear();
    vi.clearAllMocks();
    provider.send.mockResolvedValue(undefined);
  });

  it('stores only a hash and verifies the development OTP once', async () => {
    await service.sendRegistrationOtp('user-1', phoneNumber, ipAddress);

    expect(provider.send).toHaveBeenCalledWith(phoneNumber, '123456');
    const storedRecord = [...redis.values.values()].find((value) => value.includes('otpHash'));
    expect(storedRecord).toBeDefined();
    expect(storedRecord).not.toContain('123456');

    await expect(service.verifyRegistrationOtp(phoneNumber, '123456', ipAddress)).resolves.toBe(
      'user-1',
    );
    await expect(
      service.verifyRegistrationOtp(phoneNumber, '123456', ipAddress),
    ).rejects.toMatchObject({ code: 'OTP_INVALID_OR_EXPIRED' });
  });

  it('rejects an incorrect OTP', async () => {
    await service.sendRegistrationOtp('user-1', phoneNumber, ipAddress);
    await expect(
      service.verifyRegistrationOtp(phoneNumber, '654321', ipAddress),
    ).rejects.toMatchObject({ code: 'OTP_INVALID_OR_EXPIRED' });
  });

  it('enforces the resend cooldown', async () => {
    await service.sendRegistrationOtp('user-1', phoneNumber, ipAddress);
    await expect(
      service.sendRegistrationOtp('user-1', phoneNumber, ipAddress),
    ).rejects.toMatchObject({ statusCode: 429, code: 'OTP_RESEND_COOLDOWN' });
  });

  it('rate-limits once the per-window send limit is exceeded', async () => {
    for (let i = 0; i < env.OTP_SEND_LIMIT; i += 1) {
      await service.sendRegistrationOtp('user-1', phoneNumber, ipAddress);
      clearCooldowns();
    }
    await expect(
      service.sendRegistrationOtp('user-1', phoneNumber, ipAddress),
    ).rejects.toMatchObject({ statusCode: 429, code: 'OTP_RATE_LIMITED' });
  });

  it('locks out after too many incorrect verification attempts', async () => {
    await service.sendRegistrationOtp('user-1', phoneNumber, ipAddress);
    for (let i = 0; i < env.OTP_MAX_ATTEMPTS; i += 1) {
      await service.verifyRegistrationOtp(phoneNumber, '654321', ipAddress).catch(() => undefined);
    }
    await expect(
      service.verifyRegistrationOtp(phoneNumber, '654321', ipAddress),
    ).rejects.toMatchObject({ statusCode: 429, code: 'OTP_ATTEMPTS_EXCEEDED' });
  });

  it('removes the OTP and cooldown if delivery fails', async () => {
    provider.send.mockRejectedValue(new Error('SMS provider unavailable'));
    await expect(service.sendRegistrationOtp('user-1', phoneNumber, ipAddress)).rejects.toThrow(
      'SMS provider unavailable',
    );
    expect(redis.values.size).toBe(0);
  });

  it('keeps registration and password-reset codes in separate namespaces', async () => {
    await service.sendRegistrationOtp('user-1', phoneNumber, ipAddress);
    await service.sendPasswordResetOtp('user-1', phoneNumber, ipAddress);

    await expect(service.verifyPasswordResetOtp(phoneNumber, '123456', ipAddress)).resolves.toBe(
      'user-1',
    );
    await expect(service.verifyRegistrationOtp(phoneNumber, '123456', ipAddress)).resolves.toBe(
      'user-1',
    );
  });
});
