import { afterEach, describe, expect, it, vi } from 'vitest';

const baseEnv = {
  DB_HOST: 'localhost',
  DB_PORT: '5432',
  DB_USER: 'u',
  DB_PASSWORD: 'p',
  DB_NAME: 'd',
  DATABASE_URL: 'postgresql://u:p@localhost:5432/d',
  REDIS_HOST: 'localhost',
  REDIS_PORT: '6379',
  REDIS_PASSWORD: 'p',
  REDIS_URL: 'redis://:p@localhost:6379/0',
  JWT_ACCESS_SECRET: 'x'.repeat(32),
  JWT_REFRESH_SECRET: 'y'.repeat(32),
  OTP_SECRET: 'z'.repeat(32),
};

const loadEnv = async (overrides: Record<string, string>) => {
  vi.resetModules();
  vi.stubEnv('NODE_ENV', overrides.NODE_ENV ?? 'test');
  for (const [key, value] of Object.entries({ ...baseEnv, ...overrides })) {
    vi.stubEnv(key, value);
  }
  return import('../src/config/env.js');
};

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('env configuration guards', () => {
  it('refuses to boot when OTP_DEVELOPMENT_CODE is set in production', async () => {
    await expect(
      loadEnv({ NODE_ENV: 'production', OTP_DEVELOPMENT_CODE: '123456' }),
    ).rejects.toThrow(/Invalid environment configuration/);
  });

  it('boots in production when OTP_DEVELOPMENT_CODE is absent', async () => {
    const { env } = await loadEnv({ NODE_ENV: 'production' });
    expect(env.NODE_ENV).toBe('production');
    expect(env.OTP_DEVELOPMENT_CODE).toBeUndefined();
  });
});
