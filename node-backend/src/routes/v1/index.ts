import { Router } from 'express';

import type { HealthController } from '../../controllers/health.controller.js';
import { createHealthRouter } from './health.routes.js';

export const createV1Router = (healthController: HealthController): Router => {
  const router = Router();

  router.use('/health', createHealthRouter(healthController));

  return router;
};
