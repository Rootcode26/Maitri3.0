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
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('Invalid environment configuration', z.flattenError(parsedEnv.error));
  throw new Error('Invalid environment configuration');
}

export const env = parsedEnv.data;
