import { randomUUID } from 'node:crypto';

import { DatabaseError } from 'pg';

import { AppError } from '../../errors/app-error.js';
import type {
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
  VerifyOtpInput,
} from './auth.schemas.js';
import type { AuthRepository } from './auth.repository.js';
import type { AuthResult, AuthUser, RegistrationResult } from './auth.types.js';
import type { OtpService } from './otp.service.js';
import { hashPassword, verifyPassword } from './password.service.js';
import {
  hashRefreshToken,
  issueAccessToken,
  issueRefreshToken,
  verifyRefreshToken,
} from './token.service.js';
import { env } from '../../config/env.js';

const invalidCredentials = () =>
  new AppError('Invalid phone number or password', {
    statusCode: 401,
    code: 'INVALID_CREDENTIALS',
  });

const refreshTtl = (remembered: boolean): number =>
  remembered ? env.JWT_REMEMBERED_REFRESH_TTL_SECONDS : env.JWT_REFRESH_TTL_SECONDS;

const expiresAt = (ttlSeconds: number): Date => new Date(Date.now() + ttlSeconds * 1000);

let dummyPasswordHash: Promise<string> | undefined;
const getDummyPasswordHash = (): Promise<string> =>
  (dummyPasswordHash ??= hashPassword(randomUUID()));

export class AuthService {
  constructor(
    private readonly repository: AuthRepository,
    private readonly otpService: OtpService,
  ) {}

  async register(input: RegisterInput, ipAddress: string): Promise<RegistrationResult> {
    if (await this.repository.findUserByPhone(input.phoneNumber)) {
      throw new AppError('Phone number is already registered', {
        statusCode: 409,
        code: 'PHONE_ALREADY_REGISTERED',
      });
    }

    const passwordHash = await hashPassword(input.password);
    let user: AuthUser;
    try {
      user = await this.repository.createPendingUser({
        name: input.name,
        phoneNumber: input.phoneNumber,
        passwordHash,
        role: input.role,
        industry: input.industry,
      });
    } catch (error) {
      if (error instanceof DatabaseError && error.code === '23505') {
        throw new AppError('Phone number is already registered', {
          statusCode: 409,
          code: 'PHONE_ALREADY_REGISTERED',
        });
      }
      throw error;
    }

    await this.otpService.sendRegistrationOtp(user.id, input.phoneNumber, ipAddress);
    return { user, verificationRequired: true };
  }

  async verifyOtp(input: VerifyOtpInput, ipAddress: string): Promise<AuthResult> {
    const userId = await this.otpService.verifyRegistrationOtp(
      input.phoneNumber,
      input.otp,
      ipAddress,
    );
    const user = await this.repository.activatePendingUser(userId, input.phoneNumber);
    if (!user) {
      throw new AppError('OTP verification cannot be completed for this account', {
        statusCode: 409,
        code: 'OTP_VERIFICATION_CONFLICT',
      });
    }
    return this.createSession(user);
  }

  async resendOtp(phoneNumber: string, ipAddress: string): Promise<void> {
    const user = await this.repository.findUserByPhone(phoneNumber);
    if (!user || user.status !== 'pending_verification') return;
    await this.otpService.sendRegistrationOtp(user.id, phoneNumber, ipAddress);
  }

  async forgotPassword(phoneNumber: string, ipAddress: string): Promise<void> {
    const user = await this.repository.findUserByPhone(phoneNumber);
    if (!user?.passwordHash || user.status !== 'active') return;
    await this.otpService.sendPasswordResetOtp(user.id, phoneNumber, ipAddress);
  }

  async resetPassword(input: ResetPasswordInput, ipAddress: string): Promise<void> {
    const userId = await this.otpService.verifyPasswordResetOtp(
      input.phoneNumber,
      input.otp,
      ipAddress,
    );
    const passwordHash = await hashPassword(input.newPassword);
    const updated = await this.repository.updatePassword(userId, input.phoneNumber, passwordHash);
    if (!updated) {
      throw new AppError('Password reset cannot be completed for this account', {
        statusCode: 409,
        code: 'PASSWORD_RESET_CONFLICT',
      });
    }
  }

  async login(input: LoginInput): Promise<AuthResult> {
    const user = await this.repository.findUserByPhone(input.phoneNumber);
    const passwordHash = user?.passwordHash ?? (await getDummyPasswordHash());
    const passwordValid = await verifyPassword(passwordHash, input.password);
    if (!user?.passwordHash || !passwordValid) {
      throw invalidCredentials();
    }
    if (user.status !== 'active') {
      throw new AppError('Account is not active', { statusCode: 403, code: 'ACCOUNT_INACTIVE' });
    }
    if (input.expectedRole && user.role !== input.expectedRole) {
      throw new AppError('This account cannot access the selected workspace', {
        statusCode: 403,
        code: 'WORKSPACE_ACCESS_DENIED',
      });
    }

    return this.createSession(
      {
        id: user.id,
        name: user.name,
        phoneNumber: user.phoneNumber,
        role: user.role,
        status: user.status,
        departmentId: user.departmentId,
        industry: user.industry,
      },
      input.rememberMe,
    );
  }

  async refresh(currentToken: string): Promise<AuthResult> {
    const claims = verifyRefreshToken(currentToken);
    const ttlSeconds = refreshTtl(claims.remembered);
    const nextRefreshToken = issueRefreshToken(claims.userId, claims.role, claims.remembered);
    const user = await this.repository.rotateRefreshToken(
      hashRefreshToken(currentToken),
      hashRefreshToken(nextRefreshToken),
      expiresAt(ttlSeconds),
    );

    if (!user || user.id !== claims.userId) {
      throw new AppError('Refresh token is invalid or has already been used', {
        statusCode: 401,
        code: 'REFRESH_TOKEN_INVALID',
      });
    }

    return {
      user,
      accessToken: issueAccessToken(user.id, user.role, user.departmentId),
      refreshToken: nextRefreshToken,
      refreshTtlSeconds: ttlSeconds,
    };
  }

  async logout(refreshToken: string | undefined): Promise<void> {
    if (refreshToken) await this.repository.revokeRefreshToken(hashRefreshToken(refreshToken));
  }

  async getCurrentUser(userId: string): Promise<AuthUser> {
    const user = await this.repository.findUserById(userId);
    if (!user) {
      throw new AppError('Authentication session is no longer valid', {
        statusCode: 401,
        code: 'SESSION_INVALID',
      });
    }
    if (user.status !== 'active') {
      throw new AppError('Account is not active', { statusCode: 403, code: 'ACCOUNT_INACTIVE' });
    }
    return user;
  }

  private async createSession(user: AuthUser, remembered = false): Promise<AuthResult> {
    const ttlSeconds = refreshTtl(remembered);
    const refreshToken = issueRefreshToken(user.id, user.role, remembered);
    await this.repository.storeRefreshToken(
      user.id,
      hashRefreshToken(refreshToken),
      expiresAt(ttlSeconds),
    );
    return {
      user,
      accessToken: issueAccessToken(user.id, user.role, user.departmentId),
      refreshToken,
      refreshTtlSeconds: ttlSeconds,
    };
  }
}
