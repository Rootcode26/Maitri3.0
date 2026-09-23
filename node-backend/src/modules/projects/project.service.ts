import { randomUUID } from 'node:crypto';

import { AppError } from '../../errors/app-error.js';
import { logger } from '../../config/logger.js';
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

export class ProjectService {
  constructor(
    private readonly repository: ProjectRepository,
    private readonly rulesEngine: RulesEngineClient | null = null,
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

  async submitProject(applicantId: string, projectId: string): Promise<ProjectRecord> {
    const result = await this.repository.submitProject(applicantId, projectId);
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
