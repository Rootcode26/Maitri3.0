import { createHmac, randomInt, timingSafeEqual, createHash } from 'node:crypto';

import { redisClient } from '../../cache/redis.js';
import { env } from '../../config/env.js';
import { AppError } from '../../errors/app-error.js';
import type { OtpProvider } from './otp-provider.js';

interface OtpRecord {
  userId: string;
  otpHash: string;
}

type OtpPurpose = 'register' | 'password-reset';

const identifier = (phoneNumber: string): string =>
  createHash('sha256').update(phoneNumber).digest('hex');

const keysFor = (phoneNumber: string, ipAddress: string, purpose: OtpPurpose) => {
  const phoneId = identifier(phoneNumber);
  const ipId = identifier(ipAddress);
  return {
    otp: `auth:otp:${purpose}:${phoneId}`,
    attempts: `auth:otp:attempts:${purpose}:${phoneId}`,
    cooldown: `auth:otp:resend:${purpose}:${phoneId}`,
    phoneLimit: `auth:otp:send-limit:${purpose}:${phoneId}`,
    ipLimit: `auth:otp:send-limit-ip:${ipId}`,
  };
};

const hashOtp = (phoneNumber: string, otp: string): string =>
  createHmac('sha256', env.OTP_SECRET).update(`${phoneNumber}:${otp}`).digest('hex');

const safeEqual = (left: string, right: string): boolean => {
  const leftBuffer = Buffer.from(left, 'hex');
  const rightBuffer = Buffer.from(right, 'hex');
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
};

const incrementWithWindow = async (key: string): Promise<number> => {
  const result = await redisClient
    .multi()
    .incr(key)
    .expire(key, env.OTP_SEND_WINDOW_SECONDS, 'NX')
    .exec();
  const count = result?.[0]?.[1];
  if (typeof count !== 'number') throw new Error('Redis did not return an OTP rate-limit count');
  return count;
};

export class OtpService {
  constructor(private readonly provider: OtpProvider) {}

  async sendRegistrationOtp(userId: string, phoneNumber: string, ipAddress: string): Promise<void> {
    return this.sendOtp('register', userId, phoneNumber, ipAddress);
  }

  async sendPasswordResetOtp(
    userId: string,
    phoneNumber: string,
    ipAddress: string,
  ): Promise<void> {
    return this.sendOtp('password-reset', userId, phoneNumber, ipAddress);
  }

  private async sendOtp(
    purpose: OtpPurpose,
    userId: string,
    phoneNumber: string,
    ipAddress: string,
  ): Promise<void> {
    const keys = keysFor(phoneNumber, ipAddress, purpose);
    const cooldownSet = await redisClient.set(
      keys.cooldown,
      '1',
      'EX',
      env.OTP_RESEND_COOLDOWN_SECONDS,
      'NX',
    );
    if (cooldownSet !== 'OK') {
      throw new AppError('Please wait before requesting another OTP', {
        statusCode: 429,
        code: 'OTP_RESEND_COOLDOWN',
      });
    }

    const [phoneCount, ipCount] = await Promise.all([
      incrementWithWindow(keys.phoneLimit),
      incrementWithWindow(keys.ipLimit),
    ]);
    if (phoneCount > env.OTP_SEND_LIMIT || ipCount > env.OTP_SEND_LIMIT) {
      await redisClient.del(keys.cooldown);
      throw new AppError('Too many OTP requests. Please try again later', {
        statusCode: 429,
        code: 'OTP_RATE_LIMITED',
      });
    }

    const otp = env.OTP_DEVELOPMENT_CODE ?? randomInt(0, 1_000_000).toString().padStart(6, '0');
    const record: OtpRecord = { userId, otpHash: hashOtp(phoneNumber, otp) };
    await redisClient
      .multi()
      .set(keys.otp, JSON.stringify(record), 'EX', env.OTP_TTL_SECONDS)
      .del(keys.attempts)
      .exec();

    try {
      await this.provider.send(phoneNumber, otp);
    } catch (error) {
      await redisClient.del(keys.otp, keys.cooldown);
      throw error;
    }
  }

  async verifyRegistrationOtp(
    phoneNumber: string,
    otp: string,
    ipAddress: string,
  ): Promise<string> {
    return this.verifyOtp('register', phoneNumber, otp, ipAddress);
  }

  async verifyPasswordResetOtp(
    phoneNumber: string,
    otp: string,
    ipAddress: string,
  ): Promise<string> {
    return this.verifyOtp('password-reset', phoneNumber, otp, ipAddress);
  }

  private async verifyOtp(
    purpose: OtpPurpose,
    phoneNumber: string,
    otp: string,
    ipAddress: string,
  ): Promise<string> {
    const keys = keysFor(phoneNumber, ipAddress, purpose);
    const serialized = await redisClient.get(keys.otp);
    if (!serialized) throw this.invalidOtp();

    let record: OtpRecord;
    try {
      record = JSON.parse(serialized) as OtpRecord;
    } catch {
      await redisClient.del(keys.otp);
      throw this.invalidOtp();
    }

    const attempts = await incrementWithWindow(keys.attempts);
    if (attempts > env.OTP_MAX_ATTEMPTS) {
      await redisClient.del(keys.otp);
      throw new AppError('Too many incorrect OTP attempts. Request a new OTP', {
        statusCode: 429,
        code: 'OTP_ATTEMPTS_EXCEEDED',
      });
    }

    if (!safeEqual(record.otpHash, hashOtp(phoneNumber, otp))) throw this.invalidOtp();

    await redisClient.del(keys.otp, keys.attempts, keys.cooldown);
    return record.userId;
  }

  private invalidOtp(): AppError {
    return new AppError('OTP is invalid or has expired', {
      statusCode: 400,
      code: 'OTP_INVALID_OR_EXPIRED',
    });
  }
}
