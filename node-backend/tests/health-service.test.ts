import { describe, expect, it, vi } from 'vitest';

import { HealthRepository } from '../src/repositories/health.repository.js';
import { HealthService } from '../src/services/health.service.js';

const createService = (
  applicationReady: boolean,
  databaseStatus: 'up' | 'down',
  redisStatus: 'up' | 'down',
) => {
  const checkDatabase = vi.fn().mockResolvedValue({ status: databaseStatus, responseTimeMs: 1 });
  const checkRedis = vi.fn().mockResolvedValue({ status: redisStatus, responseTimeMs: 2 });
  const repository = new HealthRepository(checkDatabase, checkRedis);
  const service = new HealthService(repository, () => applicationReady);

  return { service, checkDatabase, checkRedis };
};

describe('HealthService', () => {
  it('returns a liveness response without checking dependencies', () => {
    const { service, checkDatabase, checkRedis } = createService(true, 'up', 'up');

    expect(service.getLiveness()).toEqual({ status: 'ok' });
    expect(checkDatabase).not.toHaveBeenCalled();
    expect(checkRedis).not.toHaveBeenCalled();
  });

  it('reports ready only when the app and all dependencies are healthy', async () => {
    const { service } = createService(true, 'up', 'up');

    await expect(service.getReadiness()).resolves.toMatchObject({ status: 'ready' });
  });

  it.each([
    [false, 'up', 'up'],
    [true, 'down', 'up'],
    [true, 'up', 'down'],
    [true, 'down', 'down'],
  ] as const)(
    'reports not ready for app=%s database=%s redis=%s',
    async (applicationReady, databaseStatus, redisStatus) => {
      const { service } = createService(applicationReady, databaseStatus, redisStatus);

      await expect(service.getReadiness()).resolves.toMatchObject({ status: 'not_ready' });
    },
  );

  it('checks PostgreSQL and Redis exactly once per readiness request', async () => {
    const { service, checkDatabase, checkRedis } = createService(true, 'up', 'up');

    await service.getReadiness();

    expect(checkDatabase).toHaveBeenCalledOnce();
    expect(checkRedis).toHaveBeenCalledOnce();
  });
});
