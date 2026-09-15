import { Router } from 'express';

import type { HealthController } from '../../controllers/health.controller.js';
import type { AuthController } from '../../modules/auth/auth.controller.js';
import { createAuthRouter } from '../../modules/auth/auth.routes.js';
import { createHealthRouter } from './health.routes.js';

export const createV1Router = (
  healthController: HealthController,
  authController: AuthController,
): Router => {
  const router = Router();

  router.use('/health', createHealthRouter(healthController));
  router.use('/auth', createAuthRouter(authController));

  return router;
};
