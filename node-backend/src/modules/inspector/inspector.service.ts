import { AppError } from '../../errors/app-error.js';
import type { ObjectStorage } from '../../integrations/s3/storage.js';
import type {
  ApprovalDecisionInput,
  DocumentReviewInput,
  InspectorQueueQuery,
} from './inspector.schemas.js';
import type { InspectorRepository } from './inspector.repository.js';

export class InspectorService {
  constructor(
    private readonly repository: InspectorRepository,
    private readonly storage: ObjectStorage | null,
  ) {}

  private departmentId(value: string | null): string {
    if (!value) {
      throw new AppError('Inspector account is not assigned to a department', {
        statusCode: 403,
        code: 'INSPECTOR_DEPARTMENT_REQUIRED',
      });
    }
    return value;
  }

  async listApplications(departmentId: string | null, filters: InspectorQueueQuery) {
    return this.repository.listApplications(this.departmentId(departmentId), filters);
  }

  async getApplication(departmentId: string | null, projectId: string) {
    const application = await this.repository.findApplication(
      projectId,
      this.departmentId(departmentId),
    );
    if (!application) {
      throw new AppError('Application not found', {
        statusCode: 404,
        code: 'APPLICATION_NOT_FOUND',
      });
    }
    return application;
  }

  async getDownloadUrl(departmentId: string | null, projectId: string, documentId: string) {
    if (!this.storage) {
      throw new AppError('Document storage is not configured', {
        statusCode: 503,
        code: 'UPLOADS_NOT_CONFIGURED',
      });
    }
    const document = await this.repository.findDocumentForDepartment(
      projectId,
      documentId,
      this.departmentId(departmentId),
    );
    if (!document) {
      throw new AppError('Document not found', {
        statusCode: 404,
        code: 'DOCUMENT_NOT_FOUND',
      });
    }
    return this.storage.signedGetUrl(document.storage_key, document.file_name);
  }

  async startReview(
    inspectorId: string,
    departmentId: string | null,
    projectId: string,
    approvalId: string,
  ) {
    const resolvedDepartmentId = this.departmentId(departmentId);
    const application = await this.getApplication(resolvedDepartmentId, projectId);
    const approval = application.approvals.find((item) => item.id === approvalId);
    if (!approval) {
      throw new AppError('Approval not found', { statusCode: 404, code: 'APPROVAL_NOT_FOUND' });
    }
    if (approval.reviewStatus !== 'pending') {
      throw new AppError('Only pending approvals can start review', {
        statusCode: 409,
        code: 'INVALID_REVIEW_TRANSITION',
      });
    }
    const updated = await this.repository.startReview(
      projectId,
      approvalId,
      resolvedDepartmentId,
      inspectorId,
    );
    if (!updated) {
      throw new AppError('The review was updated by another inspector', {
        statusCode: 409,
        code: 'REVIEW_CONFLICT',
      });
    }
    return this.getApplication(resolvedDepartmentId, projectId);
  }

  async reviewDocument(
    inspectorId: string,
    departmentId: string | null,
    projectId: string,
    documentId: string,
    input: DocumentReviewInput,
  ) {
    const resolvedDepartmentId = this.departmentId(departmentId);
    const document = await this.repository.findDocumentForDepartment(
      projectId,
      documentId,
      resolvedDepartmentId,
    );
    if (!document) {
      throw new AppError('Document not found', { statusCode: 404, code: 'DOCUMENT_NOT_FOUND' });
    }
    const application = await this.getApplication(resolvedDepartmentId, projectId);
    const approval = application.approvals.find(
      (item) => item.approvalKey === document.approval_key,
    );
    if (!approval || !['under_review', 'correction_required'].includes(approval.reviewStatus)) {
      throw new AppError('Start the approval review before reviewing documents', {
        statusCode: 409,
        code: 'REVIEW_NOT_STARTED',
      });
    }
    const reviewed = await this.repository.reviewDocument({
      projectId,
      documentId,
      departmentId: resolvedDepartmentId,
      inspectorId,
      status: input.status,
      ...(input.comment ? { comment: input.comment } : {}),
    });
    if (!reviewed) {
      throw new AppError('The document review could not be saved', {
        statusCode: 409,
        code: 'REVIEW_CONFLICT',
      });
    }
    return reviewed;
  }

  async decideApproval(
    inspectorId: string,
    departmentId: string | null,
    projectId: string,
    approvalId: string,
    input: ApprovalDecisionInput,
  ) {
    const resolvedDepartmentId = this.departmentId(departmentId);
    const application = await this.getApplication(resolvedDepartmentId, projectId);
    const approval = application.approvals.find((item) => item.id === approvalId);
    if (!approval) {
      throw new AppError('Approval not found', { statusCode: 404, code: 'APPROVAL_NOT_FOUND' });
    }
    if (!['under_review', 'correction_required'].includes(approval.reviewStatus)) {
      throw new AppError('Start the approval review before recording a decision', {
        statusCode: 409,
        code: 'REVIEW_NOT_STARTED',
      });
    }

    if (input.decision === 'approved') {
      const latest = new Map<string, (typeof application.documents)[number]>();
      for (const document of application.documents.filter(
        (item) => item.approvalKey === approval.approvalKey,
      )) {
        const current = latest.get(document.documentKey);
        if (!current || document.version > current.version)
          latest.set(document.documentKey, document);
      }
      const incomplete = approval.documents
        .filter((requirement) => requirement.required !== false)
        .filter((requirement) => latest.get(requirement.key)?.review.status !== 'accepted')
        .map((requirement) => requirement.name);
      if (incomplete.length > 0) {
        throw new AppError('Accept all required documents before approving', {
          statusCode: 422,
          code: 'DOCUMENT_REVIEWS_INCOMPLETE',
          details: { documents: incomplete },
        });
      }
    }

    const updated = await this.repository.decideApproval({
      projectId,
      approvalId,
      departmentId: resolvedDepartmentId,
      inspectorId,
      decision: input.decision,
      ...(input.note ? { note: input.note } : {}),
    });
    if (!updated) {
      throw new AppError('The decision could not be recorded', {
        statusCode: 409,
        code: 'INVALID_REVIEW_TRANSITION',
      });
    }
    return updated;
  }
}
