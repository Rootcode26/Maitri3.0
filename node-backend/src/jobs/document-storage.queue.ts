import { Queue, Worker, type Processor } from 'bullmq';
import { Redis } from 'ioredis';

import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

export const DOCUMENT_STORAGE_QUEUE = 'document-storage';

/** The bytes of one scanned upload, staged in the job until a worker stores it. */
export interface DocumentStorageJob {
  documentId: string;
  storageKey: string;
  contentType: string;
  /** base64 of the scanned file buffer (uploads are capped at UPLOAD_MAX_SIZE_MB). */
  bytesBase64: string;
}

// BullMQ requires a dedicated connection with retries disabled for its blocking
// reads, so we do not reuse the app's shared redisClient here.
const createConnection = (): Redis =>
  new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    connectTimeout: env.REDIS_CONNECT_TIMEOUT_MS,
  });

let queue: Queue<DocumentStorageJob> | null = null;

export const getDocumentStorageQueue = (): Queue<DocumentStorageJob> => {
  if (!queue) {
    queue = new Queue<DocumentStorageJob>(DOCUMENT_STORAGE_QUEUE, {
      connection: createConnection(),
      defaultJobOptions: {
        attempts: 5,
        backoff: { type: 'exponential', delay: 2_000 },
        removeOnComplete: true,
        removeOnFail: 100,
      },
    });
  }
  return queue;
};

export const enqueueDocumentStorage = async (job: DocumentStorageJob): Promise<void> => {
  await getDocumentStorageQueue().add('store', job, { jobId: job.documentId });
};

export const createDocumentStorageWorker = (
  processor: Processor<DocumentStorageJob>,
): Worker<DocumentStorageJob> => {
  const worker = new Worker<DocumentStorageJob>(DOCUMENT_STORAGE_QUEUE, processor, {
    connection: createConnection(),
    concurrency: env.DOCUMENT_STORAGE_CONCURRENCY,
  });
  worker.on('failed', (job, error) => {
    logger.error(
      { err: error, documentId: job?.data.documentId, attempts: job?.attemptsMade },
      'Document storage job failed',
    );
  });
  worker.on('completed', (job) => {
    logger.debug({ documentId: job.data.documentId }, 'Document stored in the background');
  });
  return worker;
};
