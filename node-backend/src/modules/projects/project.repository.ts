import { databasePool, query } from '../../database/database.js';
import type { RecommendedApproval } from './project.rules.js';
import type { CreateProjectInput } from './project.schemas.js';
import type {
  ApprovalDocument,
  ApplicantClarification,
  ApplicantApplicationDetail,
  ApplicantDocument,
  ApplicationStatusEvent,
  Industry,
  ProjectApprovalRecord,
  ProjectDepartment,
  ProjectRecord,
  ProjectStatus,
  ProjectSummary,
} from './project.types.js';

interface ApplicantClarificationRow {
  id: string;
  project_id: string;
  approval_id: string;
  approval_title: string;
  department_name: string;
  document_id: string | null;
  document_name: string | null;
  inspector_name: string;
  message: string;
  status: 'open' | 'responded' | 'resolved';
  due_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

interface ApplicantClarificationResponseRow {
  id: string;
  clarification_id: string;
  message: string;
  created_at: Date;
}

interface ApplicantDocumentRow {
  id: string;
  project_id: string;
  approval_key: string;
  approval_title: string;
  department_name: string;
  document_key: string;
  document_name: string;
  version: number;
  file_name: string;
  mime_type: string;
  size_bytes: string;
  expires_on: Date | null;
  created_at: Date;
  review_status: ApplicantDocument['review']['status'] | null;
  review_comment: string | null;
  reviewed_at: Date | null;
}

interface StatusEventRow {
  id: string;
  approval_id: string | null;
  approval_title: string | null;
  actor_name: string;
  actor_role: 'applicant' | 'inspector';
  from_status: string;
  to_status: string;
  note: string | null;
  created_at: Date;
}

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
  submitted_at: Date | null;
}

interface ProjectSummaryRow {
  id: string;
  enterprise_name: string;
  industry: Industry;
  district: string;
  primary_activity: string;
  status: ProjectStatus;
  created_at: Date;
  submitted_at: Date | null;
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
  review_status: ProjectApprovalRecord['reviewStatus'];
  review_started_at: Date | null;
  decided_at: Date | null;
  decided_by: string | null;
  decision_note: string | null;
}

const mapSummary = (row: ProjectSummaryRow): ProjectSummary => ({
  id: row.id,
  enterpriseName: row.enterprise_name,
  industry: row.industry,
  district: row.district,
  primaryActivity: row.primary_activity,
  status: row.status,
  createdAt: row.created_at.toISOString(),
  submittedAt: row.submitted_at?.toISOString() ?? null,
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
  reviewStatus: row.review_status,
  reviewStartedAt: row.review_started_at?.toISOString() ?? null,
  decidedAt: row.decided_at?.toISOString() ?? null,
  decidedBy: row.decided_by,
  decisionNote: row.decision_note,
});

const mapApplicantDocument = (row: ApplicantDocumentRow): ApplicantDocument => ({
  id: row.id,
  projectId: row.project_id,
  approvalKey: row.approval_key,
  approvalTitle: row.approval_title,
  departmentName: row.department_name,
  documentKey: row.document_key,
  documentName: row.document_name,
  version: row.version,
  fileName: row.file_name,
  mimeType: row.mime_type,
  sizeBytes: Number(row.size_bytes),
  expiresOn: row.expires_on?.toISOString().slice(0, 10) ?? null,
  createdAt: row.created_at.toISOString(),
  review: {
    status: row.review_status ?? 'pending',
    comment: row.review_comment,
    reviewedAt: row.reviewed_at?.toISOString() ?? null,
  },
});

const mapStatusEvent = (row: StatusEventRow): ApplicationStatusEvent => ({
  id: row.id,
  approvalId: row.approval_id,
  approvalTitle: row.approval_title,
  actorName: row.actor_name,
  actorRole: row.actor_role,
  fromStatus: row.from_status,
  toStatus: row.to_status,
  note: row.note,
  createdAt: row.created_at.toISOString(),
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
  submittedAt: row.submitted_at?.toISOString() ?? null,
});

export class ProjectRepository {
  async createProject(
    applicantId: string,
    projectId: string,
    input: CreateProjectInput,
    approvals: readonly RecommendedApproval[],
  ): Promise<ProjectRecord> {
    const client = await databasePool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO projects (id, applicant_id, enterprise_name, industry, district, primary_activity, details)
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
        [
          projectId,
          applicantId,
          input.enterpriseName,
          input.industry,
          input.district,
          input.primaryActivity,
          JSON.stringify(input),
        ],
      );

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
              status, details, created_at, updated_at, submitted_at
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
      `SELECT id, enterprise_name, industry, district, primary_activity, status, created_at,
              submitted_at
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

  async submitProject(
    applicantId: string,
    projectId: string,
    attention: { score: number; level: string; factors?: unknown[] } | null = null,
    validationFlags: unknown | null = null,
  ): Promise<{ project: ProjectRecord | null; missingDocuments: string[]; conflict: boolean }> {
    const client = await databasePool.connect();
    try {
      await client.query('BEGIN');
      const projectResult = await client.query<{ status: ProjectStatus }>(
        `SELECT status FROM projects WHERE id = $1 AND applicant_id = $2 FOR UPDATE`,
        [projectId, applicantId],
      );
      const current = projectResult.rows[0];
      if (!current) {
        await client.query('ROLLBACK');
        return { project: null, missingDocuments: [], conflict: false };
      }
      if (current.status !== 'draft') {
        await client.query('ROLLBACK');
        return { project: null, missingDocuments: [], conflict: true };
      }

      const approvalResult = await client.query<{
        approval_key: string;
        documents: ApprovalDocument[];
      }>(`SELECT approval_key, documents FROM project_approvals WHERE project_id = $1`, [
        projectId,
      ]);
      const uploadedResult = await client.query<{ approval_key: string; document_key: string }>(
        `SELECT DISTINCT approval_key, document_key FROM project_documents WHERE project_id = $1`,
        [projectId],
      );
      const uploaded = new Set(
        uploadedResult.rows.map((row) => `${row.approval_key}:${row.document_key}`),
      );
      const missingDocuments = approvalResult.rows.flatMap((approval) =>
        approval.documents
          .filter((document) => document.required !== false)
          .filter((document) => !uploaded.has(`${approval.approval_key}:${document.key}`))
          .map((document) => document.name),
      );
      if (missingDocuments.length > 0) {
        await client.query('ROLLBACK');
        return { project: null, missingDocuments, conflict: false };
      }

      await client.query(
        `UPDATE projects
            SET status = 'submitted', submitted_at = NOW(),
                attention_score = $2, attention_level = $3, attention_factors = $4,
                validation_flags = $5
          WHERE id = $1`,
        [
          projectId,
          attention?.score ?? null,
          attention?.level ?? null,
          attention?.factors ? JSON.stringify(attention.factors) : null,
          validationFlags ? JSON.stringify(validationFlags) : null,
        ],
      );
      await client.query(
        `INSERT INTO application_status_history
           (project_id, actor_id, from_status, to_status, note)
         VALUES ($1, $2, 'draft', 'submitted', 'Application submitted for departmental review')`,
        [projectId, applicantId],
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    return {
      project: await this.findProjectById(projectId),
      missingDocuments: [],
      conflict: false,
    };
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
                 d.id AS department_id, d."key" AS department_key, d.name AS department_name,
                 pa.review_status, pa.review_started_at, pa.decided_at, pa.decided_by,
                 pa.decision_note`,
      [projectId, approvalId, departmentKey],
    );
    return result.rows[0] ? mapApproval(result.rows[0]) : null;
  }

  async findClarificationsByApplicant(
    applicantId: string,
    projectId: string,
  ): Promise<ApplicantClarification[] | null> {
    const ownsProject = await query(`SELECT 1 FROM projects WHERE id = $1 AND applicant_id = $2`, [
      projectId,
      applicantId,
    ]);
    if (!ownsProject.rowCount) return null;
    const requests = await query<ApplicantClarificationRow>(
      `SELECT cr.id, cr.project_id, cr.approval_id, pa.title AS approval_title,
              department.name AS department_name, cr.document_id,
              document.file_name AS document_name, inspector.name AS inspector_name,
              cr.message, cr.status, cr.due_at, cr.created_at, cr.updated_at
       FROM clarification_requests cr
       JOIN project_approvals pa ON pa.id = cr.approval_id
       JOIN departments department ON department.id = pa.department_id
       JOIN users inspector ON inspector.id = cr.inspector_id
       LEFT JOIN project_documents document ON document.id = cr.document_id
       WHERE cr.project_id = $1
       ORDER BY cr.created_at DESC`,
      [projectId],
    );
    const responses = await query<ApplicantClarificationResponseRow>(
      `SELECT response.id, response.clarification_id, response.message, response.created_at
       FROM clarification_responses response
       JOIN clarification_requests cr ON cr.id = response.clarification_id
       WHERE cr.project_id = $1 AND response.applicant_id = $2
       ORDER BY response.created_at`,
      [projectId, applicantId],
    );
    return requests.rows.map((row) => ({
      id: row.id,
      projectId: row.project_id,
      approvalId: row.approval_id,
      approvalTitle: row.approval_title,
      departmentName: row.department_name,
      documentId: row.document_id,
      documentName: row.document_name,
      inspectorName: row.inspector_name,
      message: row.message,
      status: row.status,
      dueAt: row.due_at?.toISOString() ?? null,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
      responses: responses.rows
        .filter((response) => response.clarification_id === row.id)
        .map((response) => ({
          id: response.id,
          message: response.message,
          createdAt: response.created_at.toISOString(),
        })),
    }));
  }

  async respondToClarification(input: {
    applicantId: string;
    projectId: string;
    clarificationId: string;
    message: string;
  }): Promise<boolean> {
    const client = await databasePool.connect();
    try {
      await client.query('BEGIN');
      const clarification = await client.query(
        `SELECT cr.id
         FROM clarification_requests cr
         JOIN projects p ON p.id = cr.project_id
         WHERE cr.id = $1 AND cr.project_id = $2 AND p.applicant_id = $3
           AND cr.status IN ('open', 'responded')
         FOR UPDATE`,
        [input.clarificationId, input.projectId, input.applicantId],
      );
      if (!clarification.rowCount) {
        await client.query('ROLLBACK');
        return false;
      }
      await client.query(
        `INSERT INTO clarification_responses (clarification_id, applicant_id, message)
         VALUES ($1, $2, $3)`,
        [input.clarificationId, input.applicantId, input.message],
      );
      await client.query(`UPDATE clarification_requests SET status = 'responded' WHERE id = $1`, [
        input.clarificationId,
      ]);
      await client.query('COMMIT');
      return true;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async findDocumentsByApplicant(
    applicantId: string,
    projectId?: string,
  ): Promise<ApplicantDocument[]> {
    const values: unknown[] = [applicantId];
    const projectFilter = projectId ? `AND p.id = $2` : '';
    if (projectId) values.push(projectId);
    const result = await query<ApplicantDocumentRow>(
      `SELECT pd.id, pd.project_id, pd.approval_key, pa.title AS approval_title,
              department.name AS department_name, pd.document_key,
              COALESCE(spec.value->>'name', pd.document_key) AS document_name,
              pd.version, pd.file_name, pd.mime_type, pd.size_bytes, pd.expires_on,
              pd.created_at, dr.status AS review_status, dr.comment AS review_comment,
              dr.reviewed_at
       FROM project_documents pd
       JOIN projects p ON p.id = pd.project_id
       JOIN project_approvals pa
         ON pa.project_id = pd.project_id AND pa.approval_key = pd.approval_key
       JOIN departments department ON department.id = pa.department_id
       LEFT JOIN LATERAL jsonb_array_elements(pa.documents) spec(value)
         ON spec.value->>'key' = pd.document_key
       LEFT JOIN document_reviews dr ON dr.document_id = pd.id
       WHERE p.applicant_id = $1 ${projectFilter}
       ORDER BY pd.created_at DESC, pd.version DESC`,
      values,
    );
    return result.rows.map(mapApplicantDocument);
  }

  async findApplicationDetailByApplicant(
    applicantId: string,
    projectId: string,
  ): Promise<ApplicantApplicationDetail | null> {
    const project = await this.findProjectById(projectId);
    if (!project || project.applicantId !== applicantId) return null;
    const [documents, clarifications, history] = await Promise.all([
      this.findDocumentsByApplicant(applicantId, projectId),
      this.findClarificationsByApplicant(applicantId, projectId),
      query<StatusEventRow>(
        `SELECT history.id, history.approval_id, pa.title AS approval_title,
                actor.name AS actor_name, actor.role AS actor_role,
                history.from_status, history.to_status, history.note, history.created_at
         FROM application_status_history history
         JOIN users actor ON actor.id = history.actor_id
         LEFT JOIN project_approvals pa ON pa.id = history.approval_id
         WHERE history.project_id = $1
         ORDER BY history.created_at DESC`,
        [projectId],
      ),
    ]);
    return {
      ...project,
      documents,
      clarifications: clarifications ?? [],
      timeline: history.rows.map(mapStatusEvent),
    };
  }

  private async findApprovalsByProject(projectId: string): Promise<ProjectApprovalRecord[]> {
    const result = await query<ApprovalRow>(
      `SELECT pa.id, pa.approval_key, pa.title, pa.status, pa.reason, pa.rule_id,
              pa.documents, pa.processing_days,
              d.id AS department_id, d."key" AS department_key, d.name AS department_name,
              pa.review_status, pa.review_started_at, pa.decided_at, pa.decided_by,
              pa.decision_note
       FROM project_approvals pa
       JOIN departments d ON d.id = pa.department_id
       WHERE pa.project_id = $1
       ORDER BY pa.created_at, pa.approval_key`,
      [projectId],
    );
    return result.rows.map(mapApproval);
  }
}
