import { Redis } from 'ioredis';

import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

export interface RedisHealth {
  status: 'up' | 'down';
  responseTimeMs: number;
}

export const redisClient = new Redis(env.REDIS_URL, {
  lazyConnect: true,
  enableReadyCheck: true,
  connectTimeout: env.REDIS_CONNECT_TIMEOUT_MS,
  commandTimeout: env.REDIS_COMMAND_TIMEOUT_MS,
  maxRetriesPerRequest: env.REDIS_MAX_RETRIES,
  retryStrategy: (attempt) => {
    if (attempt > env.REDIS_MAX_RETRIES) return null;
    return Math.min(attempt * 200, 2_000);
  },
  reconnectOnError: (error) => (error.message.includes('READONLY') ? 1 : false),
});

redisClient.on('connect', () => {
  logger.debug('Redis TCP connection established');
});

redisClient.on('ready', () => {
  logger.info('Redis client is ready');
});

redisClient.on('reconnecting', (delay: number) => {
  logger.warn({ delayMs: delay }, 'Redis client is reconnecting');
});

redisClient.on('close', () => {
  logger.warn('Redis connection closed');
});

redisClient.on('end', () => {
  logger.info('Redis client stopped reconnecting');
});

redisClient.on('error', (error) => {
  logger.error({ err: error }, 'Redis client error');
});

export const connectRedis = async (): Promise<void> => {
  const startedAt = performance.now();

  if (redisClient.status === 'wait' || redisClient.status === 'end') {
    await redisClient.connect();
  }

  const response = await redisClient.ping();
  if (response !== 'PONG') throw new Error('Redis returned an unexpected PING response');

  logger.info(
    { responseTimeMs: Math.round(performance.now() - startedAt) },
    'Redis connection verified',
  );
};

export const checkRedisHealth = async (): Promise<RedisHealth> => {
  const startedAt = performance.now();

  try {
    const response = await redisClient.ping();
    if (response !== 'PONG') throw new Error('Redis returned an unexpected PING response');

    return {
      status: 'up',
      responseTimeMs: Math.round(performance.now() - startedAt),
    };
  } catch (error) {
    logger.warn({ err: error }, 'Redis health check failed');

    return {
      status: 'down',
      responseTimeMs: Math.round(performance.now() - startedAt),
    };
  }
};

export const closeRedis = async (): Promise<void> => {
  if (redisClient.status === 'end') return;

  if (redisClient.status === 'wait') {
    redisClient.disconnect(false);
    logger.info('Redis client closed');
    return;
  }

  try {
    await redisClient.quit();
    logger.info('Redis client closed');
  } catch (error) {
    logger.error({ err: error }, 'Failed to close Redis cleanly; disconnecting');
    redisClient.disconnect(false);
    throw error;
  }
};
