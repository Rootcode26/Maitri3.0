import { Router } from 'express';

import { requireAuthentication, requireRoles } from '../auth/auth.middleware.js';
import type { InspectorController } from './inspector.controller.js';

export const createInspectorRouter = (controller: InspectorController): Router => {
  const router = Router();
  router.use(requireAuthentication, requireRoles('inspector'));
  router.get('/applications', controller.list);
  router.get('/clarifications', controller.listClarifications);
  router.get('/decisions', controller.listDecisions);
  router.get('/inspections', controller.listInspections);
  router.post('/inspections', controller.scheduleInspection);
  router.patch('/inspections/:inspectionId', controller.updateInspection);
  router.get('/reports', controller.getReport);
  router.get('/applications/:projectId', controller.getOne);
  router.post(
    '/applications/:projectId/approvals/:approvalId/start-review',
    controller.startReview,
  );
  router.post('/applications/:projectId/approvals/:approvalId/decision', controller.decide);
  router.post(
    '/applications/:projectId/approvals/:approvalId/clarifications',
    controller.createClarification,
  );
  router.post(
    '/applications/:projectId/clarifications/:clarificationId/resolve',
    controller.resolveClarification,
  );
  router.get('/applications/:projectId/documents/:documentId/download', controller.download);
  router.post('/applications/:projectId/documents/:documentId/review', controller.reviewDocument);
  return router;
};
