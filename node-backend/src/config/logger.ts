import { createRequire } from 'node:module';

import pino from 'pino';

import { env } from './env.js';
import { pinoRedaction, serializeErrorSafely } from './redaction.js';

// Pretty logging is a dev convenience and `pino-pretty` is a devDependency, so
// it is absent from the pruned production image. Only reach for the transport
// when the package can actually be resolved; otherwise fall back to structured
// JSON logs (correct for a server, and what a NODE_ENV=development container
// without dev deps will use).
const prettyTransportAvailable = (): boolean => {
  try {
    createRequire(import.meta.url).resolve('pino-pretty');
    return true;
  } catch {
    return false;
  }
};

const transport =
  env.NODE_ENV === 'development' && prettyTransportAvailable()
    ? pino.transport({
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
          singleLine: true,
        },
      })
    : undefined;

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
  transport,
);
