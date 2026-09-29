import { AppError } from '../../errors/app-error.js';
import type { CertificateService } from '../certificates/certificate.service.js';
import type { NotificationService } from '../notifications/notification.service.js';
import type { ObjectStorage } from '../../integrations/s3/storage.js';
import type {
  ApprovalDecisionInput,
  CreateClarificationInput,
  DocumentReviewInput,
  InspectorQueueQuery,
  ScheduleInspectionInput,
  UpdateInspectionInput,
} from './inspector.schemas.js';
import type { InspectorRepository } from './inspector.repository.js';

export class InspectorService {
  constructor(
    private readonly repository: InspectorRepository,
    private readonly storage: ObjectStorage | null,
    private readonly certificates: CertificateService | null = null,
    private readonly notifications: NotificationService | null = null,
  ) {}

  private requireCertificates(): CertificateService {
    if (!this.certificates) {
      throw new AppError('Certificates are not enabled', {
        statusCode: 503,
        code: 'CERTIFICATES_NOT_CONFIGURED',
      });
    }
    return this.certificates;
  }

  /** Certificate metadata for a project in the inspector's department. */
  async getCertificate(departmentId: string | null, projectId: string) {
    await this.getApplication(this.departmentId(departmentId), projectId);
    return this.requireCertificates().getForProject(projectId);
  }

  /** A short-lived signed download URL for a department project's certificate. */
  async getCertificateDownloadUrl(departmentId: string | null, projectId: string): Promise<string> {
    await this.getApplication(this.departmentId(departmentId), projectId);
    return this.requireCertificates().getDownloadUrl(projectId);
  }

  /** Revoke the certificate for a project in the inspector's department. */
  async revokeCertificate(departmentId: string | null, projectId: string, reason: string) {
    await this.getApplication(this.departmentId(departmentId), projectId);
    return this.requireCertificates().revoke(projectId, reason);
  }

  private departmentId(value: string | null): string {
    if (!value) {
      throw new AppError('Inspector account is not assigned to a department', {
        statusCode: 403,
        code: 'INSPECTOR_DEPARTMENT_REQUIRED',
      });
    }
    return value;
  }

  async listApplications(
    departmentId: string | null,
    filters: InspectorQueueQuery,
    currentUserId: string,
  ) {
    return this.repository.listApplications(
      this.departmentId(departmentId),
      filters,
      currentUserId,
    );
  }

  async listOfficers(departmentId: string | null) {
    return this.repository.listDepartmentOfficers(this.departmentId(departmentId));
  }

  /** Assign (or, with a null assignee, unassign) an approval to a department officer. */
  async assignApproval(
    departmentId: string | null,
    projectId: string,
    approvalId: string,
    assigneeId: string | null,
  ) {
    const resolvedDepartmentId = this.departmentId(departmentId);
    const owned = await this.repository.approvalInDepartment(
      projectId,
      approvalId,
      resolvedDepartmentId,
    );
    if (!owned) {
      throw new AppError('Approval not found', { statusCode: 404, code: 'APPROVAL_NOT_FOUND' });
    }
    if (assigneeId) {
      const eligible = await this.repository.assigneeInDepartment(assigneeId, resolvedDepartmentId);
      if (!eligible) {
        throw new AppError('The selected officer is not in this department', {
          statusCode: 422,
          code: 'ASSIGNEE_NOT_IN_DEPARTMENT',
        });
      }
    }
    await this.repository.setApprovalAssignee(
      projectId,
      approvalId,
      resolvedDepartmentId,
      assigneeId,
    );
    return this.getApplication(resolvedDepartmentId, projectId);
  }

  async listClarifications(departmentId: string | null) {
    return this.repository.listClarifications(this.departmentId(departmentId));
  }

  async listDecisions(departmentId: string | null) {
    return this.repository.listDecisions(this.departmentId(departmentId));
  }

  async listInspections(departmentId: string | null) {
    return this.repository.listInspections(this.departmentId(departmentId));
  }

  async getReport(departmentId: string | null) {
    return this.repository.getReport(this.departmentId(departmentId));
  }

  async scheduleInspection(
    departmentId: string | null,
    inspectorId: string,
    input: ScheduleInspectionInput,
  ) {
    const resolvedDepartmentId = this.departmentId(departmentId);
    const owned = await this.repository.approvalInDepartment(
      input.projectId,
      input.approvalId,
      resolvedDepartmentId,
    );
    if (!owned) {
      throw new AppError('Approval not found for this department', {
        statusCode: 404,
        code: 'APPROVAL_NOT_FOUND',
      });
    }
    return this.repository.scheduleInspection({
      projectId: input.projectId,
      approvalId: input.approvalId,
      departmentId: resolvedDepartmentId,
      scheduledAt: input.scheduledAt,
      notes: input.notes ?? null,
      createdBy: inspectorId,
    });
  }

  async updateInspection(
    departmentId: string | null,
    inspectionId: string,
    input: UpdateInspectionInput,
  ) {
    const inspection = await this.repository.updateInspection({
      inspectionId,
      departmentId: this.departmentId(departmentId),
      ...input,
    });
    if (!inspection) {
      throw new AppError('Inspection not found', {
        statusCode: 404,
        code: 'INSPECTION_NOT_FOUND',
      });
    }
    return inspection;
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

  async getDownloadUrl(
    departmentId: string | null,
    projectId: string,
    documentId: string,
    options?: { inline?: boolean },
  ) {
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
    return this.storage.signedGetUrl(
      document.storage_key,
      document.file_name,
      options?.inline ? 'inline' : 'attachment',
    );
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

  async createClarification(
    inspectorId: string,
    departmentId: string | null,
    projectId: string,
    approvalId: string,
    input: CreateClarificationInput,
  ) {
    const resolvedDepartmentId = this.departmentId(departmentId);
    const application = await this.getApplication(resolvedDepartmentId, projectId);
    const approval = application.approvals.find((item) => item.id === approvalId);
    if (!approval) {
      throw new AppError('Approval not found', { statusCode: 404, code: 'APPROVAL_NOT_FOUND' });
    }
    if (!['under_review', 'correction_required'].includes(approval.reviewStatus)) {
      throw new AppError('Start the approval review before requesting clarification', {
        statusCode: 409,
        code: 'REVIEW_NOT_STARTED',
      });
    }
    if (input.documentId) {
      const document = application.documents.find(
        (item) => item.id === input.documentId && item.approvalKey === approval.approvalKey,
      );
      if (!document) {
        throw new AppError('Document not found', { statusCode: 404, code: 'DOCUMENT_NOT_FOUND' });
      }
    }
    const created = await this.repository.createClarification({
      inspectorId,
      departmentId: resolvedDepartmentId,
      projectId,
      approvalId,
      message: input.message,
      ...(input.documentId ? { documentId: input.documentId } : {}),
      ...(input.dueAt ? { dueAt: input.dueAt } : {}),
    });
    if (!created) {
      throw new AppError('The clarification request could not be created', {
        statusCode: 409,
        code: 'CLARIFICATION_CONFLICT',
      });
    }
    await this.notifications?.notifyClarificationRequested(
      application.applicant.id,
      projectId,
      approval.title,
    );
    return this.getApplication(resolvedDepartmentId, projectId);
  }

  async resolveClarification(
    departmentId: string | null,
    projectId: string,
    clarificationId: string,
  ) {
    const resolvedDepartmentId = this.departmentId(departmentId);
    await this.getApplication(resolvedDepartmentId, projectId);
    const resolved = await this.repository.resolveClarification({
      departmentId: resolvedDepartmentId,
      projectId,
      clarificationId,
    });
    if (!resolved) {
      throw new AppError('Open clarification request not found', {
        statusCode: 404,
        code: 'CLARIFICATION_NOT_FOUND',
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
      const unresolvedClarifications = application.clarifications.filter(
        (item) => item.approvalId === approvalId && item.status !== 'resolved',
      );
      if (unresolvedClarifications.length > 0) {
        throw new AppError('Resolve all clarification requests before approving', {
          statusCode: 422,
          code: 'CLARIFICATIONS_UNRESOLVED',
          details: { clarificationIds: unresolvedClarifications.map((item) => item.id) },
        });
      }
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

    await this.notifications?.notifyApprovalDecided(updated.applicant.id, projectId, {
      approvalTitle: approval.title,
      decision: input.decision,
    });

    // When this decision clears the last outstanding approval, the project
    // becomes fully approved — issue the clearance certificate automatically.
    // Issuance never rolls back the recorded decision.
    if (updated.projectStatus === 'approved' && this.certificates) {
      await this.certificates.issueForProjectSafely(projectId, inspectorId);
    }

    return updated;
  }
}
