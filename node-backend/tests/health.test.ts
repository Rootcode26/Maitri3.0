import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '../src/app.js';

describe('health endpoints', () => {
  const databaseUp = async () => ({ status: 'up' as const, responseTimeMs: 2 });
  const databaseDown = async () => ({ status: 'down' as const, responseTimeMs: 5 });
  const redisUp = async () => ({ status: 'up' as const, responseTimeMs: 1 });
  const redisDown = async () => ({ status: 'down' as const, responseTimeMs: 4 });

  it('reports that the process is live', async () => {
    const response = await request(createApp()).get('/api/v1/health/live');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });

  it('reports readiness when the application and PostgreSQL are ready', async () => {
    const response = await request(
      createApp({ isReady: () => true, checkDatabase: databaseUp, checkRedis: redisUp }),
    ).get('/api/v1/health/ready');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: 'ready',
      checks: {
        database: { status: 'up', responseTimeMs: 2 },
        redis: { status: 'up', responseTimeMs: 1 },
      },
    });
  });

  it('reports unavailable while the application is shutting down', async () => {
    const response = await request(
      createApp({ isReady: () => false, checkDatabase: databaseUp, checkRedis: redisUp }),
    ).get('/api/v1/health/ready');

    expect(response.status).toBe(503);
    expect(response.body).toEqual({
      status: 'not_ready',
      checks: {
        database: { status: 'up', responseTimeMs: 2 },
        redis: { status: 'up', responseTimeMs: 1 },
      },
    });
  });

  it('reports unavailable when PostgreSQL is down', async () => {
    const response = await request(
      createApp({ isReady: () => true, checkDatabase: databaseDown, checkRedis: redisUp }),
    ).get('/api/v1/health/ready');

    expect(response.status).toBe(503);
    expect(response.body).toEqual({
      status: 'not_ready',
      checks: {
        database: { status: 'down', responseTimeMs: 5 },
        redis: { status: 'up', responseTimeMs: 1 },
      },
    });
  });

  it('reports unavailable when Redis is down', async () => {
    const response = await request(
      createApp({ isReady: () => true, checkDatabase: databaseUp, checkRedis: redisDown }),
    ).get('/api/v1/health/ready');

    expect(response.status).toBe(503);
    expect(response.body).toEqual({
      status: 'not_ready',
      checks: {
        database: { status: 'up', responseTimeMs: 2 },
        redis: { status: 'down', responseTimeMs: 4 },
      },
    });
  });
});
