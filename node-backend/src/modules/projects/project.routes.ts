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
  router.get('/documents', controller.listDocuments);
  router.get('/:id/application', controller.getApplicationDetail);
  router.get('/:id/certificate', controller.getCertificate);
  router.get('/:id/certificate/download', controller.downloadCertificate);
  router.get('/:id', controller.getOne);
  router.post('/:id/submit', controller.submit);
  router.get('/:id/clarifications', controller.listClarifications);
  router.post('/:id/clarifications/:clarificationId/responses', controller.respondToClarification);
  router.patch('/:id/approvals/:approvalId', controller.updateApprovalDepartment);
  router.post('/:id/validate', documentController.validate);
  router.use('/:id/documents', createDocumentRouter(documentController));
  return router;
};
