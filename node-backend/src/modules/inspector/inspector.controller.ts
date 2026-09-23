import type { RequestHandler } from 'express';

import {
  approvalDecisionSchema,
  approvalParamsSchema,
  clarificationParamsSchema,
  createClarificationSchema,
  documentParamsSchema,
  documentReviewSchema,
  inspectorQueueQuerySchema,
  projectIdParamsSchema,
} from './inspector.schemas.js';
import type { InspectorService } from './inspector.service.js';

export class InspectorController {
  constructor(private readonly service: InspectorService) {}

  readonly list: RequestHandler = async (request, response) => {
    const filters = inspectorQueueQuerySchema.parse(request.query);
    const result = await this.service.listApplications(request.user!.departmentId, filters);
    response.status(200).json({
      status: 'success',
      data: {
        applications: result.items,
        pagination: {
          page: filters.page,
          pageSize: filters.pageSize,
          total: result.total,
          totalPages: Math.ceil(result.total / filters.pageSize),
        },
      },
    });
  };

  readonly getOne: RequestHandler = async (request, response) => {
    const { projectId } = projectIdParamsSchema.parse(request.params);
    const application = await this.service.getApplication(request.user!.departmentId, projectId);
    response.status(200).json({ status: 'success', data: { application } });
  };

  readonly download: RequestHandler = async (request, response) => {
    const { projectId, documentId } = documentParamsSchema.parse(request.params);
    const url = await this.service.getDownloadUrl(
      request.user!.departmentId,
      projectId,
      documentId,
    );
    response.status(200).json({ status: 'success', data: { url } });
  };

  readonly startReview: RequestHandler = async (request, response) => {
    const { projectId, approvalId } = approvalParamsSchema.parse(request.params);
    const application = await this.service.startReview(
      request.user!.userId,
      request.user!.departmentId,
      projectId,
      approvalId,
    );
    response.status(200).json({ status: 'success', data: { application } });
  };

  readonly reviewDocument: RequestHandler = async (request, response) => {
    const { projectId, documentId } = documentParamsSchema.parse(request.params);
    const input = documentReviewSchema.parse(request.body);
    const document = await this.service.reviewDocument(
      request.user!.userId,
      request.user!.departmentId,
      projectId,
      documentId,
      input,
    );
    response.status(200).json({ status: 'success', data: { document } });
  };

  readonly createClarification: RequestHandler = async (request, response) => {
    const { projectId, approvalId } = approvalParamsSchema.parse(request.params);
    const input = createClarificationSchema.parse(request.body);
    const application = await this.service.createClarification(
      request.user!.userId,
      request.user!.departmentId,
      projectId,
      approvalId,
      input,
    );
    response.status(201).json({ status: 'success', data: { application } });
  };

  readonly resolveClarification: RequestHandler = async (request, response) => {
    const { projectId, clarificationId } = clarificationParamsSchema.parse(request.params);
    const application = await this.service.resolveClarification(
      request.user!.departmentId,
      projectId,
      clarificationId,
    );
    response.status(200).json({ status: 'success', data: { application } });
  };

  readonly decide: RequestHandler = async (request, response) => {
    const { projectId, approvalId } = approvalParamsSchema.parse(request.params);
    const input = approvalDecisionSchema.parse(request.body);
    const application = await this.service.decideApproval(
      request.user!.userId,
      request.user!.departmentId,
      projectId,
      approvalId,
      input,
    );
    response.status(200).json({ status: 'success', data: { application } });
  };
}
