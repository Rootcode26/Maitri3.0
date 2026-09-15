import { argon2id, hash, verify as verifyPassword } from 'argon2';
import {
  JsonWebTokenError,
  sign,
  TokenExpiredError,
  verify as verifyToken,
  type JwtPayload,
} from 'jsonwebtoken';
import { describe, expect, it } from 'vitest';

describe('authentication cryptography dependencies', () => {
  it('hashes and verifies passwords with Argon2id', async () => {
    const passwordHash = await hash('correct-horse-battery-staple', {
      type: argon2id,
      memoryCost: 19_456,
      timeCost: 2,
      parallelism: 1,
    });

    await expect(verifyPassword(passwordHash, 'correct-horse-battery-staple')).resolves.toBe(true);
    await expect(verifyPassword(passwordHash, 'wrong-password')).resolves.toBe(false);
    expect(passwordHash).toMatch(/^\$argon2id\$/);
  });

  it('signs and verifies typed JWT claims', () => {
    interface TestClaims extends JwtPayload {
      sub: string;
      role: 'user';
    }

    const secret = 'test-only-jwt-secret-with-at-least-32-characters';
    const token = sign({ role: 'user' }, secret, {
      subject: 'user-1',
      algorithm: 'HS256',
      expiresIn: '5m',
    });
    const claims = verifyToken(token, secret, { algorithms: ['HS256'] }) as TestClaims;

    expect(claims.sub).toBe('user-1');
    expect(claims.role).toBe('user');
  });

  it('rejects an expired JWT', () => {
    const secret = 'test-only-jwt-secret-with-at-least-32-characters';
    const token = sign({ role: 'user' }, secret, { expiresIn: -1 });

    expect(() => verifyToken(token, secret, { algorithms: ['HS256'] })).toThrow(TokenExpiredError);
  });

  it('rejects a JWT with a modified signature', () => {
    const secret = 'test-only-jwt-secret-with-at-least-32-characters';
    const token = sign({ role: 'user' }, secret, { algorithm: 'HS256' });
    const tamperedToken = `${token.slice(0, -1)}${token.endsWith('a') ? 'b' : 'a'}`;

    expect(() => verifyToken(tamperedToken, secret, { algorithms: ['HS256'] })).toThrow(
      JsonWebTokenError,
    );
  });

  it('rejects JWT algorithms outside the verification allowlist', () => {
    const secret = 'test-only-jwt-secret-with-at-least-32-characters';
    const token = sign({ role: 'user' }, secret, { algorithm: 'HS384' });

    expect(() => verifyToken(token, secret, { algorithms: ['HS256'] })).toThrow(JsonWebTokenError);
  });

  it('rejects malformed Argon2 hashes', async () => {
    await expect(verifyPassword('not-an-argon2-hash', 'password')).rejects.toThrow();
  });
});
