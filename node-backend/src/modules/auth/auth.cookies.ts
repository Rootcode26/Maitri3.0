import type { CookieOptions, Response } from 'express';

import { env } from '../../config/env.js';

export const ACCESS_TOKEN_COOKIE = 'access_token';
export const REFRESH_TOKEN_COOKIE = 'refresh_token';

const baseCookieOptions = (): CookieOptions => ({
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'lax',
});

export const setAuthCookies = (
  response: Response,
  accessToken: string,
  refreshToken: string,
  refreshTtlSeconds = env.JWT_REFRESH_TTL_SECONDS,
): void => {
  response.cookie(ACCESS_TOKEN_COOKIE, accessToken, {
    ...baseCookieOptions(),
    path: '/',
    maxAge: env.JWT_ACCESS_TTL_SECONDS * 1000,
  });
  response.cookie(REFRESH_TOKEN_COOKIE, refreshToken, {
    ...baseCookieOptions(),
    path: '/api/v1/auth',
    maxAge: refreshTtlSeconds * 1000,
  });
};

export const clearAuthCookies = (response: Response): void => {
  response.clearCookie(ACCESS_TOKEN_COOKIE, { ...baseCookieOptions(), path: '/' });
  response.clearCookie(REFRESH_TOKEN_COOKIE, {
    ...baseCookieOptions(),
    path: '/api/v1/auth',
  });
};
