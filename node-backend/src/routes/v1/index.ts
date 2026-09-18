import { Router } from 'express';

import type { HealthController } from '../../controllers/health.controller.js';
import type { AuthController } from '../../modules/auth/auth.controller.js';
import { requireAuthentication } from '../../modules/auth/auth.middleware.js';
import { createAuthRouter } from '../../modules/auth/auth.routes.js';
import type { DocumentController } from '../../modules/documents/document.controller.js';
import type { ProjectController } from '../../modules/projects/project.controller.js';
import { createProjectRouter } from '../../modules/projects/project.routes.js';
import { createHealthRouter } from './health.routes.js';

export const createV1Router = (
  healthController: HealthController,
  authController: AuthController,
  projectController: ProjectController,
  documentController: DocumentController,
): Router => {
  const router = Router();

  router.use('/health', createHealthRouter(healthController));
  router.use('/auth', createAuthRouter(authController));
  router.use('/projects', createProjectRouter(projectController, documentController));
  router.get('/departments', requireAuthentication, projectController.listDepartments);

  return router;
};
