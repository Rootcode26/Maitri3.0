import type { RequestHandler } from 'express';

import { AppError } from '../../errors/app-error.js';
import { revokeAccessToken } from './access-token-store.js';
import {
  ACCESS_TOKEN_COOKIE,
  clearAuthCookies,
  REFRESH_TOKEN_COOKIE,
  setAuthCookies,
} from './auth.cookies.js';
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resendOtpSchema,
  resetPasswordSchema,
  verifyOtpSchema,
} from './auth.schemas.js';
import type { AuthService } from './auth.service.js';
import { verifyAccessToken } from './token.service.js';

export class AuthController {
  constructor(private readonly authService: AuthService) {}

  readonly register: RequestHandler = async (request, response) => {
    const result = await this.authService.register(
      registerSchema.parse(request.body),
      request.ip ?? 'unknown',
    );
    // Registering must never leave a prior session active. Without this, a
    // browser that still holds a valid cookie from an earlier login would keep
    // showing the new applicant as "signed in" before they verify their OTP.
    clearAuthCookies(response);
    response.status(201).json({ status: 'success', data: result });
  };

  readonly verifyOtp: RequestHandler = async (request, response) => {
    const result = await this.authService.verifyOtp(
      verifyOtpSchema.parse(request.body),
      request.ip ?? 'unknown',
    );
    setAuthCookies(response, result.accessToken, result.refreshToken, result.refreshTtlSeconds);
    response.status(200).json({ status: 'success', data: { user: result.user } });
  };

  readonly resendOtp: RequestHandler = async (request, response) => {
    const { phoneNumber } = resendOtpSchema.parse(request.body);
    await this.authService.resendOtp(phoneNumber, request.ip ?? 'unknown');
    response.status(202).json({
      status: 'success',
      message: 'If the account is awaiting verification, a new OTP has been sent',
    });
  };

  readonly login: RequestHandler = async (request, response) => {
    const result = await this.authService.login(loginSchema.parse(request.body));
    setAuthCookies(response, result.accessToken, result.refreshToken, result.refreshTtlSeconds);
    response.status(200).json({ status: 'success', data: { user: result.user } });
  };

  readonly refresh: RequestHandler = async (request, response) => {
    const refreshToken = request.cookies[REFRESH_TOKEN_COOKIE] as unknown;
    if (typeof refreshToken !== 'string' || refreshToken.length === 0) {
      throw new AppError('Refresh token is required', {
        statusCode: 401,
        code: 'REFRESH_TOKEN_REQUIRED',
      });
    }
    const result = await this.authService.refresh(refreshToken);
    setAuthCookies(response, result.accessToken, result.refreshToken, result.refreshTtlSeconds);
    response.status(200).json({ status: 'success', data: { user: result.user } });
  };

  readonly logout: RequestHandler = async (request, response) => {
    const refreshToken = request.cookies[REFRESH_TOKEN_COOKIE] as unknown;
    const accessToken = request.cookies[ACCESS_TOKEN_COOKIE] as unknown;
    await this.authService.logout(typeof refreshToken === 'string' ? refreshToken : undefined);

    if (typeof accessToken === 'string') {
      try {
        const claims = verifyAccessToken(accessToken);
        await revokeAccessToken(claims.jti, claims.exp);
      } catch {
        // Logout remains idempotent even when a cookie is already invalid or expired.
      }
    }

    clearAuthCookies(response);
    response.status(204).send();
  };

  readonly forgotPassword: RequestHandler = async (request, response) => {
    const { phoneNumber } = forgotPasswordSchema.parse(request.body);
    await this.authService.forgotPassword(phoneNumber, request.ip ?? 'unknown');
    response.status(202).json({
      status: 'success',
      message: 'If an eligible account exists, a password reset code has been sent',
    });
  };

  readonly resetPassword: RequestHandler = async (request, response) => {
    await this.authService.resetPassword(
      resetPasswordSchema.parse(request.body),
      request.ip ?? 'unknown',
    );
    clearAuthCookies(response);
    response.status(200).json({
      status: 'success',
      message: 'Password reset successfully',
    });
  };

  readonly me: RequestHandler = async (request, response) => {
    const user = await this.authService.getCurrentUser(request.user!.userId);
    response.status(200).json({ status: 'success', data: { user } });
  };
}
