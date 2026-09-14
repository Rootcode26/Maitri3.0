import { beforeEach, describe, expect, it, vi } from 'vitest';

const redisMocks = vi.hoisted(() => {
  const registeredEvents: string[] = [];

  return {
    connect: vi.fn(),
    ping: vi.fn(),
    quit: vi.fn(),
    disconnect: vi.fn(),
    on: vi.fn((event: string) => {
      registeredEvents.push(event);
    }),
    registeredEvents,
    status: 'wait',
  };
});

vi.mock('ioredis', () => ({
  Redis: class MockRedis {
    connect = redisMocks.connect;
    ping = redisMocks.ping;
    quit = redisMocks.quit;
    disconnect = redisMocks.disconnect;
    on = redisMocks.on;

    get status() {
      return redisMocks.status;
    }
  },
}));

import { checkRedisHealth, closeRedis, connectRedis } from '../src/cache/redis.js';

describe('Redis lifecycle', () => {
  beforeEach(() => {
    redisMocks.connect.mockReset();
    redisMocks.ping.mockReset();
    redisMocks.quit.mockReset();
    redisMocks.disconnect.mockReset();
    redisMocks.status = 'wait';
  });

  it('registers all required lifecycle event handlers', () => {
    expect(redisMocks.registeredEvents).toEqual([
      'connect',
      'ready',
      'reconnecting',
      'close',
      'end',
      'error',
    ]);
  });

  it('connects and verifies Redis during startup', async () => {
    redisMocks.connect.mockResolvedValueOnce(undefined);
    redisMocks.ping.mockResolvedValueOnce('PONG');

    await expect(connectRedis()).resolves.toBeUndefined();
    expect(redisMocks.connect).toHaveBeenCalledOnce();
    expect(redisMocks.ping).toHaveBeenCalledOnce();
  });

  it('does not reconnect an already connected client', async () => {
    redisMocks.status = 'ready';
    redisMocks.ping.mockResolvedValueOnce('PONG');

    await connectRedis();

    expect(redisMocks.connect).not.toHaveBeenCalled();
    expect(redisMocks.ping).toHaveBeenCalledOnce();
  });

  it('propagates a startup connection failure', async () => {
    const connectionError = new Error('Connection refused');
    redisMocks.connect.mockRejectedValueOnce(connectionError);

    await expect(connectRedis()).rejects.toBe(connectionError);
  });

  it('rejects an unexpected startup PING response', async () => {
    redisMocks.connect.mockResolvedValueOnce(undefined);
    redisMocks.ping.mockResolvedValueOnce('NOT_PONG');

    await expect(connectRedis()).rejects.toThrow('unexpected PING response');
  });

  it('reports a healthy Redis service', async () => {
    redisMocks.ping.mockResolvedValueOnce('PONG');

    await expect(checkRedisHealth()).resolves.toMatchObject({
      status: 'up',
      responseTimeMs: expect.any(Number),
    });
  });

  it('reports an unhealthy Redis service without throwing', async () => {
    redisMocks.ping.mockRejectedValueOnce(new Error('Redis unavailable'));

    await expect(checkRedisHealth()).resolves.toMatchObject({
      status: 'down',
      responseTimeMs: expect.any(Number),
    });
  });

  it('reports an unexpected PING response as unhealthy', async () => {
    redisMocks.ping.mockResolvedValueOnce('NOT_PONG');

    await expect(checkRedisHealth()).resolves.toMatchObject({
      status: 'down',
      responseTimeMs: expect.any(Number),
    });
  });

  it('disconnects a client that has not connected yet', async () => {
    await closeRedis();

    expect(redisMocks.disconnect).toHaveBeenCalledWith(false);
    expect(redisMocks.quit).not.toHaveBeenCalled();
  });

  it('quits a connected client cleanly', async () => {
    redisMocks.status = 'ready';
    redisMocks.quit.mockResolvedValueOnce('OK');

    await closeRedis();

    expect(redisMocks.quit).toHaveBeenCalledOnce();
  });

  it('forces a disconnect and propagates a failed clean shutdown', async () => {
    const quitError = new Error('Quit failed');
    redisMocks.status = 'ready';
    redisMocks.quit.mockRejectedValueOnce(quitError);

    await expect(closeRedis()).rejects.toBe(quitError);
    expect(redisMocks.disconnect).toHaveBeenCalledWith(false);
  });

  it('does nothing when the client has already ended', async () => {
    redisMocks.status = 'end';

    await closeRedis();

    expect(redisMocks.quit).not.toHaveBeenCalled();
    expect(redisMocks.disconnect).not.toHaveBeenCalled();
  });
});
