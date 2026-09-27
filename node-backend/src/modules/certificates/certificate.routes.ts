import { Router } from 'express';

import type { CertificateController } from './certificate.controller.js';

/** Public certificate verification — intentionally unauthenticated. */
export const createCertificateVerifyRouter = (controller: CertificateController): Router => {
  const router = Router();
  router.get('/:verificationCode', controller.verify);
  return router;
};
