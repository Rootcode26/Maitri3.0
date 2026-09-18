import { createHash } from 'node:crypto';

import type { RequestHandler } from 'express';

import { redisClient } from '../cache/redis.js';
import { AppError } from '../errors/app-error.js';

interface RateLimitOptions {
  name: string;
  limit: number;
  windowSeconds: number;
}

const clientId = (ip: string): string => createHash('sha256').update(ip).digest('hex');

export const createRateLimiter = ({
  name,
  limit,
  windowSeconds,
}: RateLimitOptions): RequestHandler => {
  return async (request, _response, next) => {
    const key = `rate-limit:${name}:${clientId(request.ip ?? 'unknown')}`;
    const result = await redisClient.multi().incr(key).expire(key, windowSeconds, 'NX').exec();
    const count = result?.[0]?.[1];
    if (typeof count !== 'number') {
      next(new Error('Redis did not return a rate-limit count'));
      return;
    }
    if (count > limit) {
      next(
        new AppError('Too many requests. Please try again later', {
          statusCode: 429,
          code: 'RATE_LIMITED',
        }),
      );
      return;
    }
    next();
  };
};
