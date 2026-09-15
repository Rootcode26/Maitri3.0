import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().max(65_535).default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  SHUTDOWN_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),
  DB_HOST: z.string().trim().min(1),
  DB_PORT: z.coerce.number().int().positive().max(65_535),
  DB_USER: z.string().trim().min(1),
  DB_PASSWORD: z.string().min(1),
  DB_NAME: z.string().trim().min(1),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  DB_POOL_MAX: z.coerce.number().int().positive().default(10),
  DB_IDLE_TIMEOUT_MS: z.coerce.number().int().nonnegative().default(30_000),
  DB_CONNECTION_TIMEOUT_MS: z.coerce.number().int().positive().default(5_000),
  DB_STATEMENT_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),
  REDIS_HOST: z.string().trim().min(1),
  REDIS_PORT: z.coerce.number().int().positive().max(65_535),
  REDIS_PASSWORD: z.string().min(1),
  REDIS_DB: z.coerce.number().int().min(0).max(15).default(0),
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
  OTP_DEVELOPMENT_CODE: z
    .string()
    .regex(/^\d{6}$/)
    .optional(),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('Invalid environment configuration', z.flattenError(parsedEnv.error));
  throw new Error('Invalid environment configuration');
}

export const env = parsedEnv.data;
