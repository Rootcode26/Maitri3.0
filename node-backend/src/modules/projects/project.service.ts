import { randomUUID } from 'node:crypto';

import { AppError } from '../../errors/app-error.js';
import { logger } from '../../config/logger.js';
import type { ProjectRepository } from './project.repository.js';
import { RulesEngineError, type RulesEngineClient } from './project.rules-client.js';
import { deriveApprovals, type RecommendedApproval } from './project.rules.js';
import type { CreateProjectInput } from './project.schemas.js';
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
      const isConfigFault =
        error instanceof RulesEngineError &&
        (error.kind === 'unauthorized' || error.kind === 'invalid-response');
      if (isConfigFault) {
        logger.error(
          { err: error },
          'Rules engine misconfiguration or contract mismatch; using built-in derivation',
        );
      } else {
        logger.warn({ err: error }, 'Rules engine unavailable; using built-in derivation');
      }
      return deriveApprovals(input);
    }
  }

  async listProjects(applicantId: string): Promise<ProjectSummary[]> {
    return this.repository.findProjectsByApplicant(applicantId);
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

  async setApprovalDepartment(
    applicantId: string,
    projectId: string,
    approvalId: string,
    departmentKey: string,
  ): Promise<ProjectApprovalRecord> {
    await this.getProject(applicantId, projectId);
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
