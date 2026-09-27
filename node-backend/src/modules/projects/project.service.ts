import { randomUUID } from 'node:crypto';

import { AppError } from '../../errors/app-error.js';
import { logger } from '../../config/logger.js';
import type {
  AttentionFactor,
  AttentionLevel,
  ValidationDocumentCheck,
  ValidationIssue,
  ValidationResult,
} from '../documents/document.validation-client.js';
import type { ProjectRepository } from './project.repository.js';
import { RulesEngineError, type RulesEngineClient } from './project.rules-client.js';
import { deriveApprovals, type RecommendedApproval } from './project.rules.js';
import type { CreateProjectInput } from './project.schemas.js';
import type { ClarificationResponseInput } from './project.schemas.js';
import type {
  ProjectApprovalRecord,
  ProjectDepartment,
  ProjectRecord,
  ProjectSummary,
} from './project.types.js';

/**
 * The subset of the document service that the submission gate depends on:
 * running a fresh validation pass for a project the applicant owns.
 */
export interface ProjectValidator {
  validateProject(applicantId: string, projectId: string): Promise<ValidationResult>;
}

/** The attention estimate persisted with a submission for inspector triage. */
export interface AttentionSummary {
  score: number;
  level: AttentionLevel;
  factors: AttentionFactor[];
}

/** The non-blocking validation flags persisted with a submission for the inspector. */
export interface ValidationFlags {
  warnings: ValidationIssue[];
  reviewItems: ValidationIssue[];
  documentChecks: ValidationDocumentCheck[];
}

export class ProjectService {
  constructor(
    private readonly repository: ProjectRepository,
    private readonly rulesEngine: RulesEngineClient | null = null,
    private readonly validator: ProjectValidator | null = null,
  ) {}

  async createProject(applicantId: string, input: CreateProjectInput): Promise<ProjectRecord> {
    const projectId = randomUUID();
    const approvals = await this.resolveApprovals(input, projectId);
    return this.repository.createProject(applicantId, projectId, input, approvals);
  }

  private async resolveApprovals(
    input: CreateProjectInput,
    projectId: string,
  ): Promise<RecommendedApproval[]> {
    if (!this.rulesEngine) {
      return deriveApprovals(input);
    }
    try {
      return await this.rulesEngine.evaluate(input, projectId);
    } catch (error) {
      if (error instanceof RulesEngineError && error.kind === 'blocked') {
        logger.warn(
          { projectId, blockingIssues: error.blockingIssues },
          'Rules engine blocked the submission; rejecting the request',
        );
        throw new AppError('This submission cannot be accepted yet', {
          statusCode: 422,
          code: 'SUBMISSION_BLOCKED',
          details: { blockingIssues: error.blockingIssues ?? [] },
        });
      }

      const isConfigFault =
        error instanceof RulesEngineError &&
        (error.kind === 'unauthorized' || error.kind === 'invalid-response');
      if (isConfigFault) {
        logger.error(
          { err: error },
          'Rules engine misconfiguration or contract mismatch; refusing to fabricate a checklist',
        );
        throw new AppError('The approval service is temporarily unavailable', {
          statusCode: 502,
          code: 'RULES_ENGINE_MISCONFIGURED',
        });
      }

      logger.warn({ err: error }, 'Rules engine unavailable; using built-in derivation');
      return deriveApprovals(input);
    }
  }

  async listProjects(applicantId: string): Promise<ProjectSummary[]> {
    return this.repository.findProjectsByApplicant(applicantId);
  }

  async listDocuments(applicantId: string) {
    return this.repository.findDocumentsByApplicant(applicantId);
  }

  async getApplicationDetail(applicantId: string, projectId: string) {
    const project = await this.repository.findApplicationDetailByApplicant(applicantId, projectId);
    if (!project) {
      throw new AppError('Project not found', { statusCode: 404, code: 'PROJECT_NOT_FOUND' });
    }
    return project;
  }

  async submitProject(applicantId: string, projectId: string): Promise<ProjectRecord> {
    // Gate submission on a fresh validation: nothing with an unresolved blocking
    // issue may enter the inspector queue. Warnings and review items do not block —
    // review items are exactly what the inspector is meant to judge. When a
    // validator is configured but unreachable, validateProject throws (502/503),
    // so submission fails closed rather than slipping past the check.
    let attention: AttentionSummary | null = null;
    let flags: ValidationFlags | null = null;
    if (this.validator) {
      const validation = await this.validator.validateProject(applicantId, projectId);
      if (validation.blockingIssues.length > 0) {
        logger.warn(
          { projectId, blockingIssues: validation.blockingIssues.length },
          'Submission blocked: validation reported unresolved blocking issues',
        );
        throw new AppError('Resolve the blocking issues before submitting', {
          statusCode: 422,
          code: 'SUBMISSION_HAS_BLOCKING_ISSUES',
          details: { blockingIssues: validation.blockingIssues },
        });
      }
      // Capture the review-effort estimate (and why) so the inspector queue can
      // triage by it and the detail view can explain it.
      const assessment = validation.attentionAssessment;
      if (assessment) {
        attention = {
          score: assessment.score,
          level: assessment.level,
          factors: assessment.factors ?? [],
        };
      }
      // Capture the non-blocking flags so the inspector sees what the automated
      // check surfaced (warnings, officer-review items, per-document checks).
      flags = {
        warnings: validation.warnings,
        reviewItems: validation.reviewItems,
        documentChecks: validation.documentChecks,
      };
    }

    const result = await this.repository.submitProject(applicantId, projectId, attention, flags);
    if (result.missingDocuments.length > 0) {
      throw new AppError('Upload all required documents before submitting', {
        statusCode: 422,
        code: 'REQUIRED_DOCUMENTS_MISSING',
        details: { missingDocuments: result.missingDocuments },
      });
    }
    if (result.conflict) {
      throw new AppError('Only draft projects can be submitted', {
        statusCode: 409,
        code: 'PROJECT_NOT_DRAFT',
      });
    }
    if (!result.project) {
      throw new AppError('Project not found', { statusCode: 404, code: 'PROJECT_NOT_FOUND' });
    }
    return result.project;
  }

  async getProject(applicantId: string, projectId: string): Promise<ProjectRecord> {
    const project = await this.repository.findProjectById(projectId);
    if (!project || project.applicantId !== applicantId) {
      throw new AppError('Project not found', { statusCode: 404, code: 'PROJECT_NOT_FOUND' });
    }
    return project;
  }

  async listDepartments(): Promise<ProjectDepartment[]> {
    return this.repository.listDepartments();
  }

  async listClarifications(applicantId: string, projectId: string) {
    const clarifications = await this.repository.findClarificationsByApplicant(
      applicantId,
      projectId,
    );
    if (!clarifications) {
      throw new AppError('Project not found', { statusCode: 404, code: 'PROJECT_NOT_FOUND' });
    }
    return clarifications;
  }

  async respondToClarification(
    applicantId: string,
    projectId: string,
    clarificationId: string,
    input: ClarificationResponseInput,
  ) {
    const responded = await this.repository.respondToClarification({
      applicantId,
      projectId,
      clarificationId,
      message: input.message,
    });
    if (!responded) {
      throw new AppError('Open clarification request not found', {
        statusCode: 404,
        code: 'CLARIFICATION_NOT_FOUND',
      });
    }
    return this.listClarifications(applicantId, projectId);
  }

  async setApprovalDepartment(
    applicantId: string,
    projectId: string,
    approvalId: string,
    departmentKey: string,
  ): Promise<ProjectApprovalRecord> {
    const project = await this.getProject(applicantId, projectId);
    if (
      ['submitted', 'under_review', 'correction_required', 'approved', 'rejected'].includes(
        project.status,
      )
    ) {
      throw new AppError('Department assignments cannot be changed after submission', {
        statusCode: 409,
        code: 'PROJECT_NOT_EDITABLE',
      });
    }
    const approval = await this.repository.updateApprovalDepartment(
      projectId,
      approvalId,
      departmentKey,
    );
    if (!approval) {
      throw new AppError('Approval not found', { statusCode: 404, code: 'APPROVAL_NOT_FOUND' });
    }
    return approval;
  }
}
