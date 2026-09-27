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
  vi.unstubAllEnvs();
  vi.stubEnv('NODE_ENV', overrides.NODE_ENV ?? 'test');
  if (!('OTP_DEVELOPMENT_CODE' in overrides)) {
    vi.stubEnv('OTP_DEVELOPMENT_CODE', undefined);
  }
  // Keep the boolean-default assertions independent of any ambient value that a
  // local .env may have leaked into process.env (Vitest auto-loads .env).
  if (!('VALIDATION_INCLUDE_DOCUMENT_BYTES' in overrides)) {
    vi.stubEnv('VALIDATION_INCLUDE_DOCUMENT_BYTES', undefined);
  }
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

  it('parses boolean env vars correctly (the string "false" is false)', async () => {
    const off = await loadEnv({
      VALIDATION_INCLUDE_DOCUMENT_BYTES: 'false',
      S3_FORCE_PATH_STYLE: 'false',
    });
    expect(off.env.VALIDATION_INCLUDE_DOCUMENT_BYTES).toBe(false);
    expect(off.env.S3_FORCE_PATH_STYLE).toBe(false);
    const on = await loadEnv({ VALIDATION_INCLUDE_DOCUMENT_BYTES: 'true' });
    expect(on.env.VALIDATION_INCLUDE_DOCUMENT_BYTES).toBe(true);
    const dflt = await loadEnv({});
    expect(dflt.env.VALIDATION_INCLUDE_DOCUMENT_BYTES).toBe(false);
  });
});
