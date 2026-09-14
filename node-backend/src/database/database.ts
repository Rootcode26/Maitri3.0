import { Pool, type QueryResult, type QueryResultRow } from 'pg';

import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

export interface DatabaseHealth {
  status: 'up' | 'down';
  responseTimeMs: number;
}

export const databasePool = new Pool({
  connectionString: env.DATABASE_URL,
  max: env.DB_POOL_MAX,
  idleTimeoutMillis: env.DB_IDLE_TIMEOUT_MS,
  connectionTimeoutMillis: env.DB_CONNECTION_TIMEOUT_MS,
  statement_timeout: env.DB_STATEMENT_TIMEOUT_MS,
  application_name: 'maitri-node-backend',
  keepAlive: true,
});

let poolClosed = false;

databasePool.on('connect', () => {
  logger.debug('PostgreSQL pool established a new client connection');
});

databasePool.on('error', (error) => {
  logger.error({ err: error }, 'Unexpected error from an idle PostgreSQL client');
});

export const query = async <Row extends QueryResultRow = QueryResultRow>(
  text: string,
  values: readonly unknown[] = [],
): Promise<QueryResult<Row>> => databasePool.query<Row>(text, [...values]);

export const connectDatabase = async (): Promise<void> => {
  const startedAt = performance.now();

  await query<{ connected: number }>('SELECT 1 AS connected');

  logger.info(
    { responseTimeMs: Math.round(performance.now() - startedAt) },
    'PostgreSQL connection verified',
  );
};

export const checkDatabaseHealth = async (): Promise<DatabaseHealth> => {
  const startedAt = performance.now();

  try {
    await query<{ healthy: number }>('SELECT 1 AS healthy');

    return {
      status: 'up',
      responseTimeMs: Math.round(performance.now() - startedAt),
    };
  } catch (error) {
    logger.warn({ err: error }, 'PostgreSQL health check failed');

    return {
      status: 'down',
      responseTimeMs: Math.round(performance.now() - startedAt),
    };
  }
};

export const closeDatabase = async (): Promise<void> => {
  if (poolClosed) return;

  poolClosed = true;

  try {
    await databasePool.end();
    logger.info('PostgreSQL connection pool closed');
  } catch (error) {
    poolClosed = false;
    logger.error({ err: error }, 'Failed to close PostgreSQL connection pool');
    throw error;
  }
};
