import pino from 'pino';

import { env } from './env.js';
import { pinoRedaction, serializeErrorSafely } from './redaction.js';

export const logger = pino(
  {
    level: env.NODE_ENV === 'test' ? 'silent' : env.LOG_LEVEL,
    redact: pinoRedaction,
    serializers: {
      err: serializeErrorSafely,
      error: serializeErrorSafely,
    },
    base: {
      service: 'maitri-node-backend',
      environment: env.NODE_ENV,
    },
  },
  env.NODE_ENV === 'development'
    ? pino.transport({
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
          singleLine: true,
        },
      })
    : undefined,
);
