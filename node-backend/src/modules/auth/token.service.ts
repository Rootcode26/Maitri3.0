import { createHash, randomUUID } from 'node:crypto';

import jwt, { type JwtPayload, type SignOptions } from 'jsonwebtoken';

import { env } from '../../config/env.js';
import { AppError } from '../../errors/app-error.js';
import { userRoles, type AuthenticatedUser, type UserRole } from './auth.types.js';

const { sign, verify } = jwt;

interface TokenClaims extends JwtPayload {
  role?: unknown;
  departmentId?: unknown;
  tokenType?: unknown;
  remembered?: unknown;
}

interface RefreshClaims extends AuthenticatedUser {
  tokenType: 'refresh';
  remembered: boolean;
}

const commonSignOptions = (): Pick<SignOptions, 'algorithm' | 'issuer' | 'audience'> => ({
  algorithm: 'HS256',
  issuer: env.JWT_ISSUER,
  audience: env.JWT_AUDIENCE,
});

const parseClaims = (payload: string | JwtPayload, tokenType: 'access' | 'refresh') => {
  if (typeof payload === 'string') {
    throw new AppError('Authentication token is invalid', { statusCode: 401, code: 'JWT_INVALID' });
  }

  const claims = payload as TokenClaims;
  if (
    typeof claims.sub !== 'string' ||
    typeof claims.jti !== 'string' ||
    typeof claims.exp !== 'number' ||
    !userRoles.includes(claims.role as UserRole) ||
    !(claims.departmentId === null || typeof claims.departmentId === 'string') ||
    claims.tokenType !== tokenType
  ) {
    throw new AppError('Authentication token is invalid', { statusCode: 401, code: 'JWT_INVALID' });
  }

  return {
    userId: claims.sub,
    role: claims.role as UserRole,
    departmentId: claims.departmentId,
    jti: claims.jti,
    exp: claims.exp,
  };
};

export const issueAccessToken = (
  userId: string,
  role: UserRole,
  departmentId: string | null = null,
): string =>
  sign({ role, departmentId, tokenType: 'access' }, env.JWT_ACCESS_SECRET, {
    ...commonSignOptions(),
    subject: userId,
    jwtid: randomUUID(),
    expiresIn: env.JWT_ACCESS_TTL_SECONDS,
  });

export const issueRefreshToken = (userId: string, role: UserRole, remembered = false): string =>
  sign({ role, departmentId: null, tokenType: 'refresh', remembered }, env.JWT_REFRESH_SECRET, {
    ...commonSignOptions(),
    subject: userId,
    jwtid: randomUUID(),
    expiresIn: remembered ? env.JWT_REMEMBERED_REFRESH_TTL_SECONDS : env.JWT_REFRESH_TTL_SECONDS,
  });

export const verifyAccessToken = (token: string): AuthenticatedUser =>
  parseClaims(
    verify(token, env.JWT_ACCESS_SECRET, {
      algorithms: ['HS256'],
      issuer: env.JWT_ISSUER,
      audience: env.JWT_AUDIENCE,
    }),
    'access',
  );

export const verifyRefreshToken = (token: string): RefreshClaims => {
  const payload = verify(token, env.JWT_REFRESH_SECRET, {
    algorithms: ['HS256'],
    issuer: env.JWT_ISSUER,
    audience: env.JWT_AUDIENCE,
  });
  return {
    ...parseClaims(payload, 'refresh'),
    tokenType: 'refresh',
    remembered: typeof payload !== 'string' && payload.remembered === true,
  };
};

export const hashRefreshToken = (token: string): string =>
  createHash('sha256').update(token).digest('hex');
