import type { DependencyHealth, HealthRepository } from '../repositories/health.repository.js';

export interface ReadinessResult {
  status: 'ready' | 'not_ready';
  checks: DependencyHealth;
}

export class HealthService {
  constructor(
    private readonly healthRepository: HealthRepository,
    private readonly isApplicationReady: () => boolean,
  ) {}

  getLiveness(): { status: 'ok' } {
    return { status: 'ok' };
  }

  async getReadiness(): Promise<ReadinessResult> {
    const checks = await this.healthRepository.checkDependencies();
    const ready =
      this.isApplicationReady() && checks.database.status === 'up' && checks.redis.status === 'up';

    return {
      status: ready ? 'ready' : 'not_ready',
      checks,
    };
  }
}
