import { Router, type RequestHandler } from 'express';
import multer from 'multer';

import { env } from '../../config/env.js';
import { AppError } from '../../errors/app-error.js';
import { createRateLimiter } from '../../middleware/rate-limit.js';
import type { DocumentController } from './document.controller.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: Math.round(env.UPLOAD_MAX_SIZE_MB * 1_000_000),
    files: 1,
    fields: 10,
    fieldSize: 1_024,
    fieldNameSize: 100,
    parts: 12,
  },
});

const uploadRateLimiter = createRateLimiter({
  name: 'document-upload',
  limit: env.UPLOAD_RATE_LIMIT,
  windowSeconds: env.UPLOAD_RATE_WINDOW_SECONDS,
});

const handleUpload: RequestHandler = (request, response, next) => {
  upload.single('file')(request, response, (error: unknown) => {
    if (error instanceof multer.MulterError) {
      const tooLarge = error.code === 'LIMIT_FILE_SIZE';
      next(
        new AppError(
          tooLarge ? `File exceeds the ${env.UPLOAD_MAX_SIZE_MB} MB limit` : 'Invalid file upload',
          {
            statusCode: tooLarge ? 413 : 400,
            code: tooLarge ? 'FILE_TOO_LARGE' : 'INVALID_UPLOAD',
          },
        ),
      );
      return;
    }
    next(error);
  });
};

export const createDocumentRouter = (controller: DocumentController): Router => {
  const router = Router({ mergeParams: true });
  router.post('/', uploadRateLimiter, handleUpload, controller.upload);
  router.get('/', controller.list);
  router.get('/:documentId/download', controller.download);
  router.delete('/:documentId', controller.remove);
  return router;
};
