import type { RequestHandler } from 'express';

import {
  approvalDecisionSchema,
  approvalParamsSchema,
  assignApprovalSchema,
  clarificationParamsSchema,
  createClarificationSchema,
  documentParamsSchema,
  documentReviewSchema,
  inspectionParamsSchema,
  inspectorQueueQuerySchema,
  projectIdParamsSchema,
  scheduleInspectionSchema,
  updateInspectionSchema,
} from './inspector.schemas.js';
import { revokeCertificateSchema } from '../certificates/certificate.schemas.js';
import type { InspectorService } from './inspector.service.js';

export class InspectorController {
  constructor(private readonly service: InspectorService) {}

  readonly list: RequestHandler = async (request, response) => {
    const filters = inspectorQueueQuerySchema.parse(request.query);
    const result = await this.service.listApplications(
      request.user!.departmentId,
      filters,
      request.user!.userId,
    );
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

  readonly listClarifications: RequestHandler = async (request, response) => {
    const clarifications = await this.service.listClarifications(request.user!.departmentId);
    response.status(200).json({ status: 'success', data: { clarifications } });
  };

  readonly listDecisions: RequestHandler = async (request, response) => {
    const decisions = await this.service.listDecisions(request.user!.departmentId);
    response.status(200).json({ status: 'success', data: { decisions } });
  };

  readonly listInspections: RequestHandler = async (request, response) => {
    const inspections = await this.service.listInspections(request.user!.departmentId);
    response.status(200).json({ status: 'success', data: { inspections } });
  };

  readonly getReport: RequestHandler = async (request, response) => {
    const report = await this.service.getReport(request.user!.departmentId);
    response.status(200).json({ status: 'success', data: { report } });
  };

  readonly scheduleInspection: RequestHandler = async (request, response) => {
    const input = scheduleInspectionSchema.parse(request.body);
    const inspection = await this.service.scheduleInspection(
      request.user!.departmentId,
      request.user!.userId,
      input,
    );
    response.status(201).json({ status: 'success', data: { inspection } });
  };

  readonly updateInspection: RequestHandler = async (request, response) => {
    const { inspectionId } = inspectionParamsSchema.parse(request.params);
    const input = updateInspectionSchema.parse(request.body);
    const inspection = await this.service.updateInspection(
      request.user!.departmentId,
      inspectionId,
      input,
    );
    response.status(200).json({ status: 'success', data: { inspection } });
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
      { inline: request.query.inline === 'true' },
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

  readonly listOfficers: RequestHandler = async (request, response) => {
    const officers = await this.service.listOfficers(request.user!.departmentId);
    response.status(200).json({ status: 'success', data: { officers } });
  };

  readonly assign: RequestHandler = async (request, response) => {
    const { projectId, approvalId } = approvalParamsSchema.parse(request.params);
    const { assigneeId } = assignApprovalSchema.parse(request.body);
    const application = await this.service.assignApproval(
      request.user!.departmentId,
      projectId,
      approvalId,
      assigneeId,
    );
    response.status(200).json({ status: 'success', data: { application } });
  };

  readonly getCertificate: RequestHandler = async (request, response) => {
    const { projectId } = projectIdParamsSchema.parse(request.params);
    const certificate = await this.service.getCertificate(request.user!.departmentId, projectId);
    response.status(200).json({ status: 'success', data: { certificate } });
  };

  readonly downloadCertificate: RequestHandler = async (request, response) => {
    const { projectId } = projectIdParamsSchema.parse(request.params);
    const url = await this.service.getCertificateDownloadUrl(request.user!.departmentId, projectId);
    response.status(200).json({ status: 'success', data: { url } });
  };

  readonly revokeCertificate: RequestHandler = async (request, response) => {
    const { projectId } = projectIdParamsSchema.parse(request.params);
    const { reason } = revokeCertificateSchema.parse(request.body);
    const certificate = await this.service.revokeCertificate(
      request.user!.departmentId,
      projectId,
      reason,
    );
    response.status(200).json({ status: 'success', data: { certificate } });
  };
}
