import 'dotenv/config';
import { z } from 'zod';

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().max(65_535).default(4000),
    TRUST_PROXY_HOPS: z.coerce.number().int().nonnegative().max(10).default(1),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    SHUTDOWN_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),
    DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
    DB_POOL_MAX: z.coerce.number().int().positive().default(10),
    DB_IDLE_TIMEOUT_MS: z.coerce.number().int().nonnegative().default(30_000),
    DB_CONNECTION_TIMEOUT_MS: z.coerce.number().int().positive().default(5_000),
    DB_STATEMENT_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),
    REDIS_URL: z.url({ protocol: /^rediss?$/ }),
    REDIS_CONNECT_TIMEOUT_MS: z.coerce.number().int().positive().default(5_000),
    REDIS_COMMAND_TIMEOUT_MS: z.coerce.number().int().positive().default(5_000),
    REDIS_MAX_RETRIES: z.coerce.number().int().nonnegative().default(5),
    JWT_ACCESS_SECRET: z.string().min(32),
    JWT_REFRESH_SECRET: z.string().min(32),
    JWT_ISSUER: z.string().trim().min(1).default('maitri-node-backend'),
    JWT_AUDIENCE: z.string().trim().min(1).default('maitri-client'),
    JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().positive().default(900),
    JWT_REFRESH_TTL_SECONDS: z.coerce.number().int().positive().default(604_800),
    JWT_REMEMBERED_REFRESH_TTL_SECONDS: z.coerce.number().int().positive().default(2_592_000),
    OTP_SECRET: z.string().min(32),
    OTP_PROVIDER: z.enum(['console', 'twilio']).default('console'),
    TWILIO_ACCOUNT_SID: z.string().trim().min(1).optional(),
    TWILIO_AUTH_TOKEN: z.string().min(1).optional(),
    TWILIO_PHONE_NUMBER: z.string().trim().min(1).optional(),
    OTP_TTL_SECONDS: z.coerce.number().int().positive().default(300),
    OTP_RESEND_COOLDOWN_SECONDS: z.coerce.number().int().positive().default(60),
    OTP_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
    OTP_SEND_LIMIT: z.coerce.number().int().positive().default(5),
    OTP_SEND_WINDOW_SECONDS: z.coerce.number().int().positive().default(300),
    AUTH_RATE_LIMIT: z.coerce.number().int().positive().default(10),
    AUTH_RATE_WINDOW_SECONDS: z.coerce.number().int().positive().default(300),
    OTP_DEVELOPMENT_CODE: z
      .string()
      .regex(/^\d{6}$/)
      .optional(),
    RULES_SERVICE_URL: z.url({ protocol: /^https?$/ }).optional(),
    RULES_SERVICE_TOKEN: z.string().min(1).optional(),
    RULES_VERSION: z.string().trim().min(1).default('2026.09'),
    RULES_SERVICE_TIMEOUT_MS: z.coerce.number().int().positive().default(5_000),
  })
  .superRefine((value, ctx) => {
    if (value.NODE_ENV === 'production' && value.OTP_DEVELOPMENT_CODE !== undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['OTP_DEVELOPMENT_CODE'],
        message: 'OTP_DEVELOPMENT_CODE must not be set when NODE_ENV=production',
      });
    }
  });

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('Invalid environment configuration', z.flattenError(parsedEnv.error));
  throw new Error('Invalid environment configuration');
}

export const env = parsedEnv.data;
