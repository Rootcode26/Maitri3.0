import { redisClient } from '../../cache/redis.js';

const keyFor = (jti: string): string => `auth:access-token:revoked:${jti}`;

export const revokeAccessToken = async (jti: string, expiresAt: number): Promise<void> => {
  const ttlSeconds = expiresAt - Math.floor(Date.now() / 1000);
  if (ttlSeconds > 0) await redisClient.set(keyFor(jti), '1', 'EX', ttlSeconds);
};

export const isAccessTokenRevoked = async (jti: string): Promise<boolean> =>
  (await redisClient.exists(keyFor(jti))) === 1;
