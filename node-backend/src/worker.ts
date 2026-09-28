import { closeDatabase, connectDatabase } from './database/database.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { startDocumentStorageWorker } from './jobs/document-storage.bootstrap.js';

// Standalone worker process: consumes background jobs (currently document
// storage) independently of the HTTP API, so the two scale and fail separately.

let shuttingDown = false;

const start = async (): Promise<void> => {
  await connectDatabase();

  const worker = startDocumentStorageWorker();
  if (!worker) {
    logger.warn(
      'No background workers are enabled (set ASYNC_DOCUMENT_STORAGE=true and configure storage). Exiting.',
    );
    await closeDatabase();
    process.exit(0);
  }

  logger.info('Worker process started');

  const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, 'Worker shutdown started');

    const forceTimer = setTimeout(() => {
      logger.error('Worker shutdown timed out; exiting');
      process.exit(1);
    }, env.SHUTDOWN_TIMEOUT_MS);
    forceTimer.unref();

    try {
      await worker.close();
      await closeDatabase();
      clearTimeout(forceTimer);
      logger.info('Worker shutdown completed');
      process.exit(0);
    } catch (error) {
      clearTimeout(forceTimer);
      logger.error({ err: error }, 'Worker shutdown failed');
      process.exit(1);
    }
  };

  process.on('SIGINT', (signal) => void shutdown(signal));
  process.on('SIGTERM', (signal) => void shutdown(signal));
};

void start().catch(async (error) => {
  logger.fatal({ err: error }, 'Worker startup failed');
  await closeDatabase().catch(() => {});
  process.exitCode = 1;
});
