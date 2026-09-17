import { Router } from 'express';

import { requireAuthentication, requireRoles } from '../auth/auth.middleware.js';
import type { ProjectController } from './project.controller.js';

export const createProjectRouter = (controller: ProjectController): Router => {
  const router = Router();
  router.use(requireAuthentication, requireRoles('applicant'));
  router.post('/', controller.create);
  router.get('/', controller.list);
  router.get('/:id', controller.getOne);
  router.patch('/:id/approvals/:approvalId', controller.updateApprovalDepartment);
  return router;
};
