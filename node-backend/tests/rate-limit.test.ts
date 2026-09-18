import express from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';

let counter = 0;

vi.mock('../src/cache/redis.js', () => ({
  redisClient: {
    multi: () => ({
      incr: () => ({
        expire: () => ({
          exec: async () => {
            counter += 1;
            return [[null, counter]];
          },
        }),
      }),
    }),
  },
}));

const { createRateLimiter } = await import('../src/middleware/rate-limit.js');
const { errorHandler } = await import('../src/middleware/error-handler.js');

const makeApp = () => {
  const app = express();
  app.set('trust proxy', 1);
  app.post(
    '/thing',
    createRateLimiter({ name: 'test', limit: 3, windowSeconds: 60 }),
    (_req, res) => res.status(200).json({ ok: true }),
  );
  app.use(errorHandler);
  return app;
};

afterEach(() => {
  counter = 0;
});

describe('createRateLimiter', () => {
  it('allows requests up to the limit and rejects the next one', async () => {
    const app = makeApp();
    for (let i = 0; i < 3; i += 1) {
      const ok = await request(app).post('/thing');
      expect(ok.status).toBe(200);
    }
    const blocked = await request(app).post('/thing');
    expect(blocked.status).toBe(429);
    expect(blocked.body).toMatchObject({ code: 'RATE_LIMITED' });
  });
});
