import { createServer } from 'node:http';

import { createApp } from './app.js';
import { closeRedis, connectRedis } from './cache/redis.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { closeDatabase, connectDatabase } from './database/database.js';
import { startDocumentStorageWorker } from './jobs/document-storage.bootstrap.js';

let ready = false;
let shuttingDown = false;

const app = createApp({ isReady: () => ready });
const server = createServer(app);
const documentStorageWorker = startDocumentStorageWorker();

const startServer = async (): Promise<void> => {
  try {
    await connectDatabase();
    await connectRedis();

    server.listen(env.PORT, () => {
      ready = true;
      logger.info({ port: env.PORT }, 'API server started');
    });
  } catch (error) {
    logger.fatal({ err: error }, 'Application startup failed');
    await Promise.allSettled([closeRedis(), closeDatabase()]);
    process.exitCode = 1;
  }
};

server.on('error', (error) => {
  ready = false;
  logger.fatal({ err: error }, 'API server failed');
  void Promise.allSettled([closeRedis(), closeDatabase()]).finally(() => {
    process.exitCode = 1;
  });
});

const closeHttpServer = (): Promise<void> =>
  new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });

const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
  if (shuttingDown) return;

  shuttingDown = true;
  ready = false;
  logger.info({ signal }, 'Graceful shutdown started');

  const forceShutdownTimer = setTimeout(() => {
    logger.error('Graceful shutdown timed out; closing active connections');
    server.closeAllConnections();
    process.exit(1);
  }, env.SHUTDOWN_TIMEOUT_MS);
  forceShutdownTimer.unref();

  try {
    server.closeIdleConnections();
    await closeHttpServer();
    if (documentStorageWorker) await documentStorageWorker.close();
    const closeResults = await Promise.allSettled([closeRedis(), closeDatabase()]);
    const failedClose = closeResults.find((result) => result.status === 'rejected');
    if (failedClose?.status === 'rejected') throw failedClose.reason;
    clearTimeout(forceShutdownTimer);
    logger.info('Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    clearTimeout(forceShutdownTimer);
    logger.error({ err: error }, 'Graceful shutdown failed');
    process.exit(1);
  }
};

process.on('SIGINT', (signal) => {
  void shutdown(signal);
});

process.on('SIGTERM', (signal) => {
  void shutdown(signal);
});

void startServer();
