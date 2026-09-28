import type { Worker } from 'bullmq';

import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { createObjectStorage } from '../integrations/s3/storage.js';
import { DocumentRepository } from '../modules/documents/document.repository.js';
import { DocumentService } from '../modules/documents/document.service.js';
import { ProjectRepository } from '../modules/projects/project.repository.js';
import { createDocumentStorageWorker, type DocumentStorageJob } from './document-storage.queue.js';

/**
 * Start the background worker that pushes staged uploads to object storage.
 * Returns null (and starts nothing) unless ASYNC_DOCUMENT_STORAGE is enabled and
 * storage is configured, so the default synchronous deployment is unaffected.
 */
export const startDocumentStorageWorker = (): Worker<DocumentStorageJob> | null => {
  if (!env.ASYNC_DOCUMENT_STORAGE) return null;

  const storage = createObjectStorage(env);
  if (!storage) {
    logger.warn(
      'ASYNC_DOCUMENT_STORAGE is enabled but object storage is not configured; worker not started',
    );
    return null;
  }

  const documents = new DocumentRepository();
  // Only storage + the document repository are used by processStorageJob; the
  // other collaborators are irrelevant to the worker.
  const service = new DocumentService(new ProjectRepository(), documents, storage, null, null, {
    defaultMaxSizeMb: env.UPLOAD_MAX_SIZE_MB,
    rulesVersion: env.RULES_VERSION,
    includeDocumentBytes: false,
  });

  const worker = createDocumentStorageWorker(async (job) => {
    try {
      await service.processStorageJob(job.data);
    } catch (error) {
      const attempts = job.opts.attempts ?? 1;
      if (job.attemptsMade + 1 >= attempts) {
        await service.markStorageFailed(job.data.documentId).catch(() => {});
      }
      throw error;
    }
  });

  logger.info('Document storage worker started');
  return worker;
};
