import pino from 'pino';
import { describe, expect, it } from 'vitest';

import {
  REDACTION_CENSOR,
  pinoRedaction,
  redactSensitiveText,
  serializeErrorSafely,
} from '../src/config/redaction.js';

const writeLog = (payload: object): string => {
  let output = '';
  const destination = {
    write(chunk: string) {
      output += chunk;
    },
  };

  pino({ redact: pinoRedaction }, destination).info(payload);
  return output;
};

describe('log redaction', () => {
  it('redacts authentication headers, cookies, and API keys', () => {
    const output = writeLog({
      req: {
        headers: {
          authorization: 'Bearer secret-token',
          cookie: 'session=secret-cookie',
          'x-api-key': 'secret-api-key',
        },
      },
    });

    expect(output).not.toContain('secret-token');
    expect(output).not.toContain('secret-cookie');
    expect(output).not.toContain('secret-api-key');
    expect(output).toContain(REDACTION_CENSOR);
  });

  it('redacts root and nested credential fields', () => {
    const output = writeLog({
      password: 'root-password',
      otp: '123456',
      otpHash: 'hashed-otp-value',
      user: {
        accessToken: 'access-token',
        idToken: 'identity-token',
        credentials: {
          refreshToken: 'refresh-token',
          clientSecret: 'client-secret',
        },
      },
      DATABASE_URL: 'postgresql://user:password@localhost/database',
    });

    for (const secret of [
      'root-password',
      '123456',
      'hashed-otp-value',
      'access-token',
      'identity-token',
      'refresh-token',
      'client-secret',
      'postgresql://user:password@localhost/database',
    ]) {
      expect(output).not.toContain(secret);
    }
  });

  it('redacts credentials embedded in URLs, authorization values, and query strings', () => {
    const input =
      'postgresql://user:pass@localhost/db Bearer abc.def?token=visible&api_key=also-visible';
    const output = redactSensitiveText(input);

    expect(output).not.toContain('user:pass');
    expect(output).not.toContain('abc.def');
    expect(output).not.toContain('token=visible');
    expect(output).not.toContain('api_key=also-visible');
    expect(output).toContain(REDACTION_CENSOR);
  });

  it('sanitizes secrets inside error messages and stack traces', () => {
    const error = new Error(
      'Connection failed: redis://:redis-password@localhost:6379 password=plain-secret',
    );
    const serialized = JSON.stringify(serializeErrorSafely(error));

    expect(serialized).not.toContain('redis-password');
    expect(serialized).not.toContain('plain-secret');
    expect(serialized).toContain(REDACTION_CENSOR);
  });

  it('redacts raw request bodies attached to parser errors', () => {
    let output = '';
    const destination = {
      write(chunk: string) {
        output += chunk;
      },
    };
    const error = Object.assign(new SyntaxError('Invalid JSON'), {
      body: '{"password":"body-secret"',
    });

    pino(
      {
        redact: pinoRedaction,
        serializers: { err: serializeErrorSafely },
      },
      destination,
    ).warn({ err: error });

    expect(output).not.toContain('body-secret');
    expect(output).toContain(REDACTION_CENSOR);
  });

  it('leaves non-Error values unchanged in the error serializer', () => {
    expect(serializeErrorSafely('failure')).toBe('failure');
  });
});
