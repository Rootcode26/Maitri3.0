import { beforeEach, describe, expect, it, vi } from 'vitest';

const poolMocks = vi.hoisted(() => {
  const registeredEvents: string[] = [];

  return {
    query: vi.fn(),
    end: vi.fn(),
    on: vi.fn((event: string) => {
      registeredEvents.push(event);
    }),
    registeredEvents,
  };
});

vi.mock('pg', () => ({
  Pool: class MockPool {
    query = poolMocks.query;
    end = poolMocks.end;
    on = poolMocks.on;
  },
}));

import {
  checkDatabaseHealth,
  closeDatabase,
  connectDatabase,
  query,
} from '../src/database/database.js';

describe('database lifecycle', () => {
  beforeEach(() => {
    poolMocks.query.mockReset();
    poolMocks.end.mockReset();
  });

  it('registers pool connection and error event handlers', () => {
    expect(poolMocks.registeredEvents).toEqual(['connect', 'error']);
  });

  it('runs parameterized queries through the shared pool', async () => {
    const result = { rows: [{ id: 'user-1' }] };
    poolMocks.query.mockResolvedValueOnce(result);

    await expect(query<{ id: string }>('SELECT $1::text AS id', ['user-1'])).resolves.toBe(result);
    expect(poolMocks.query).toHaveBeenCalledWith('SELECT $1::text AS id', ['user-1']);
  });

  it('verifies the database connection during startup', async () => {
    poolMocks.query.mockResolvedValueOnce({ rows: [{ connected: 1 }] });

    await expect(connectDatabase()).resolves.toBeUndefined();
    expect(poolMocks.query).toHaveBeenCalledWith('SELECT 1 AS connected', []);
  });

  it('propagates a failed startup connection check', async () => {
    const connectionError = new Error('Connection refused');
    poolMocks.query.mockRejectedValueOnce(connectionError);

    await expect(connectDatabase()).rejects.toBe(connectionError);
  });

  it('reports an available database', async () => {
    poolMocks.query.mockResolvedValueOnce({ rows: [{ healthy: 1 }] });

    await expect(checkDatabaseHealth()).resolves.toMatchObject({
      status: 'up',
      responseTimeMs: expect.any(Number),
    });
  });

  it('reports an unavailable database without throwing', async () => {
    poolMocks.query.mockRejectedValueOnce(new Error('Database unavailable'));

    await expect(checkDatabaseHealth()).resolves.toMatchObject({
      status: 'down',
      responseTimeMs: expect.any(Number),
    });
  });

  it('closes the pool only once', async () => {
    poolMocks.end.mockResolvedValueOnce(undefined);

    await closeDatabase();
    await closeDatabase();

    expect(poolMocks.end).toHaveBeenCalledTimes(1);
  });
});
