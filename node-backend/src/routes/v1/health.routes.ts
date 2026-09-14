import { Router } from 'express';

import type { HealthController } from '../../controllers/health.controller.js';

export const createHealthRouter = (healthController: HealthController): Router => {
  const router = Router();

  router.get('/live', healthController.live);
  router.get('/ready', healthController.ready);

  return router;
};
