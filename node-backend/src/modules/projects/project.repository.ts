import { databasePool, query } from '../../database/database.js';
import type { RecommendedApproval } from './project.rules.js';
import type { CreateProjectInput } from './project.schemas.js';
import type {
  ApprovalDocument,
  Industry,
  ProjectApprovalRecord,
  ProjectDepartment,
  ProjectRecord,
  ProjectStatus,
  ProjectSummary,
} from './project.types.js';

interface ProjectRow {
  id: string;
  applicant_id: string;
  enterprise_name: string;
  industry: Industry;
  district: string;
  primary_activity: string;
  status: ProjectStatus;
  details: CreateProjectInput;
  created_at: Date;
  updated_at: Date;
}

interface ProjectSummaryRow {
  id: string;
  enterprise_name: string;
  industry: Industry;
  district: string;
  primary_activity: string;
  status: ProjectStatus;
  created_at: Date;
}

interface ApprovalRow {
  id: string;
  approval_key: string;
  title: string;
  status: ProjectApprovalRecord['status'];
  reason: string | null;
  rule_id: string | null;
  documents: ApprovalDocument[];
  processing_days: number;
  department_id: string;
  department_key: string;
  department_name: string;
}

const mapSummary = (row: ProjectSummaryRow): ProjectSummary => ({
  id: row.id,
  enterpriseName: row.enterprise_name,
  industry: row.industry,
  district: row.district,
  primaryActivity: row.primary_activity,
  status: row.status,
  createdAt: row.created_at.toISOString(),
});

const mapApproval = (row: ApprovalRow): ProjectApprovalRecord => ({
  id: row.id,
  approvalKey: row.approval_key,
  title: row.title,
  status: row.status,
  ...(row.reason !== null ? { reason: row.reason } : {}),
  ...(row.rule_id !== null ? { ruleId: row.rule_id } : {}),
  documents: row.documents,
  processingDays: row.processing_days,
  department: { id: row.department_id, key: row.department_key, name: row.department_name },
});

const mapProject = (row: ProjectRow, approvals: ProjectApprovalRecord[]): ProjectRecord => ({
  id: row.id,
  applicantId: row.applicant_id,
  enterpriseName: row.enterprise_name,
  industry: row.industry,
  district: row.district,
  primaryActivity: row.primary_activity,
  status: row.status,
  details: row.details,
  approvals,
  createdAt: row.created_at.toISOString(),
  updatedAt: row.updated_at.toISOString(),
});

export class ProjectRepository {
  async createProject(
    applicantId: string,
    input: CreateProjectInput,
    approvals: readonly RecommendedApproval[],
  ): Promise<ProjectRecord> {
    const client = await databasePool.connect();
    let projectId: string;
    try {
      await client.query('BEGIN');
      const projectResult = await client.query<{ id: string }>(
        `INSERT INTO projects (applicant_id, enterprise_name, industry, district, primary_activity, details)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb)
         RETURNING id`,
        [
          applicantId,
          input.enterpriseName,
          input.industry,
          input.district,
          input.primaryActivity,
          JSON.stringify(input),
        ],
      );
      projectId = projectResult.rows[0]!.id;

      for (const approval of approvals) {
        await client.query(
          `INSERT INTO project_approvals
             (project_id, approval_key, title, department_id, status, documents, processing_days, reason, rule_id)
           VALUES ($1, $2, $3, (SELECT id FROM departments WHERE "key" = $4), $5, $6::jsonb, $7, $8, $9)`,
          [
            projectId,
            approval.key,
            approval.title,
            approval.departmentKey,
            approval.status,
            JSON.stringify(approval.documents),
            approval.processingDays,
            approval.reason ?? null,
            approval.ruleId ?? null,
          ],
        );
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    const record = await this.findProjectById(projectId);
    if (!record) throw new Error('Project could not be read back after creation');
    return record;
  }

  async findProjectById(projectId: string): Promise<ProjectRecord | null> {
    const result = await query<ProjectRow>(
      `SELECT id, applicant_id, enterprise_name, industry, district, primary_activity,
              status, details, created_at, updated_at
       FROM projects WHERE id = $1`,
      [projectId],
    );
    const row = result.rows[0];
    if (!row) return null;
    const approvals = await this.findApprovalsByProject(projectId);
    return mapProject(row, approvals);
  }

  async findProjectsByApplicant(applicantId: string): Promise<ProjectSummary[]> {
    const result = await query<ProjectSummaryRow>(
      `SELECT id, enterprise_name, industry, district, primary_activity, status, created_at
       FROM projects WHERE applicant_id = $1
       ORDER BY created_at DESC`,
      [applicantId],
    );
    return result.rows.map(mapSummary);
  }

  async listDepartments(): Promise<ProjectDepartment[]> {
    const result = await query<{ id: string; key: string; name: string }>(
      `SELECT id, "key", name FROM departments ORDER BY name`,
    );
    return result.rows.map((row) => ({ id: row.id, key: row.key, name: row.name }));
  }

  async updateApprovalDepartment(
    projectId: string,
    approvalId: string,
    departmentKey: string,
  ): Promise<ProjectApprovalRecord | null> {
    const result = await query<ApprovalRow>(
      `UPDATE project_approvals AS pa
       SET department_id = d.id
       FROM departments d
       WHERE pa.id = $2 AND pa.project_id = $1 AND d."key" = $3
       RETURNING pa.id, pa.approval_key, pa.title, pa.status, pa.reason, pa.rule_id,
                 pa.documents, pa.processing_days,
                 d.id AS department_id, d."key" AS department_key, d.name AS department_name`,
      [projectId, approvalId, departmentKey],
    );
    return result.rows[0] ? mapApproval(result.rows[0]) : null;
  }

  private async findApprovalsByProject(projectId: string): Promise<ProjectApprovalRecord[]> {
    const result = await query<ApprovalRow>(
      `SELECT pa.id, pa.approval_key, pa.title, pa.status, pa.reason, pa.rule_id,
              pa.documents, pa.processing_days,
              d.id AS department_id, d."key" AS department_key, d.name AS department_name
       FROM project_approvals pa
       JOIN departments d ON d.id = pa.department_id
       WHERE pa.project_id = $1
       ORDER BY pa.created_at, pa.approval_key`,
      [projectId],
    );
    return result.rows.map(mapApproval);
  }
}
