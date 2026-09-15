import twilio from 'twilio';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';

export interface OtpProvider {
  send(phoneNumber: string, otp: string): Promise<void>;
}

class ConsoleOtpProvider implements OtpProvider {
  async send(phoneNumber: string, _otp: string): Promise<void> {
    if (env.NODE_ENV === 'production') {
      throw new Error('The console OTP provider cannot be used in production');
    }

    logger.info(
      { phoneNumberSuffix: phoneNumber.slice(-4) },
      'Development OTP generated; use OTP_DEVELOPMENT_CODE to verify',
    );
  }
}

class TwilioOtpProvider implements OtpProvider {
  private client: ReturnType<typeof twilio>;

  constructor() {
    if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN || !env.TWILIO_PHONE_NUMBER) {
      throw new Error(
        'TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_PHONE_NUMBER must be set when OTP_PROVIDER=twilio',
      );
    }
    this.client = twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);
  }

  async send(phoneNumber: string, otp: string): Promise<void> {
    await this.client.messages.create({
      body: `Your UdyogSetu OTP is ${otp}. Valid for 10 minutes. Do not share this code.`,
      from: env.TWILIO_PHONE_NUMBER!,
      to: phoneNumber,
    });

    logger.info({ phoneNumberSuffix: phoneNumber.slice(-4) }, 'OTP sent via Twilio');
  }
}

if (env.NODE_ENV === 'production' && env.OTP_PROVIDER === 'console') {
  throw new Error('OTP_PROVIDER=console is forbidden in production');
}

export const otpProvider: OtpProvider =
  env.OTP_PROVIDER === 'twilio' ? new TwilioOtpProvider() : new ConsoleOtpProvider();
