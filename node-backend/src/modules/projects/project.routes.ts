import { Router } from 'express';

import { requireAuthentication, requireRoles } from '../auth/auth.middleware.js';
import type { DocumentController } from '../documents/document.controller.js';
import { createDocumentRouter } from '../documents/document.routes.js';
import type { ProjectController } from './project.controller.js';

export const createProjectRouter = (
  controller: ProjectController,
  documentController: DocumentController,
): Router => {
  const router = Router();
  router.use(requireAuthentication, requireRoles('applicant'));
  router.post('/', controller.create);
  router.get('/', controller.list);
  router.get('/:id', controller.getOne);
  router.patch('/:id/approvals/:approvalId', controller.updateApprovalDepartment);
  router.post('/:id/validate', documentController.validate);
  router.use('/:id/documents', createDocumentRouter(documentController));
  return router;
};
