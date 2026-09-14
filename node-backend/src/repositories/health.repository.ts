import { checkRedisHealth, type RedisHealth } from '../cache/redis.js';
import { checkDatabaseHealth, type DatabaseHealth } from '../database/database.js';

export interface DependencyHealth {
  database: DatabaseHealth;
  redis: RedisHealth;
}

export class HealthRepository {
  constructor(
    private readonly checkDatabase: () => Promise<DatabaseHealth> = checkDatabaseHealth,
    private readonly checkRedis: () => Promise<RedisHealth> = checkRedisHealth,
  ) {}

  async checkDependencies(): Promise<DependencyHealth> {
    const [database, redis] = await Promise.all([this.checkDatabase(), this.checkRedis()]);

    return { database, redis };
  }
}
