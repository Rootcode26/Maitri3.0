import { databasePool, query } from '../../database/database.js';
import type { CreateProjectInput } from '../projects/project.schemas.js';
import type {
  ApprovalDocument,
  ApprovalReviewStatus,
  Industry,
  ProjectStatus,
} from '../projects/project.types.js';
import type { DocumentExtractionStatus, DocumentReadStatus } from '../documents/document.types.js';
import type { InspectorQueueQuery } from './inspector.schemas.js';
import type {
  DocumentReviewStatus,
  ClarificationRequest,
  InspectorApplicationDetail,
  InspectorApplicationSummary,
  InspectorApproval,
  InspectorDocument,
} from './inspector.types.js';

interface ClarificationRow {
  id: string;
  project_id: string;
  approval_id: string;
  document_id: string | null;
  inspector_id: string;
  inspector_name: string;
  message: string;
  status: 'open' | 'responded' | 'resolved';
  due_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

interface ClarificationResponseRow {
  id: string;
  clarification_id: string;
  applicant_id: string;
  applicant_name: string;
  message: string;
  created_at: Date;
}

interface QueueRow {
  project_id: string;
  approval_id: string;
  approval_key: string;
  approval_title: string;
  enterprise_name: string;
  applicant_name: string;
  industry: Industry;
  district: string;
  project_status: ProjectStatus;
  review_status: ApprovalReviewStatus;
  submitted_at: Date;
  attention_score: number | null;
  attention_level: string | null;
}

interface DetailRow {
  project_id: string;
  enterprise_name: string;
  industry: Industry;
  district: string;
  primary_activity: string;
  project_status: ProjectStatus;
  submitted_at: Date;
  applicant_id: string;
  applicant_name: string;
  applicant_phone: string;
  details: CreateProjectInput;
}

interface ApprovalRow {
  id: string;
  approval_key: string;
  title: string;
  status: 'required' | 'recommended';
  review_status: ApprovalReviewStatus;
  decision_note: string | null;
  review_started_at: Date | null;
  decided_at: Date | null;
  processing_days: number;
  documents: ApprovalDocument[];
}

interface DocumentRow {
  id: string;
  project_id: string;
  approval_key: string;
  document_key: string;
  version: number;
  file_name: string;
  mime_type: string;
  detected_mime_type: string | null;
  size_bytes: string;
  storage_key: string;
  file_read_status: DocumentReadStatus;
  extraction_status: DocumentExtractionStatus;
  expires_on: Date | null;
  created_at: Date;
  updated_at: Date;
  review_status: DocumentReviewStatus | null;
  review_comment: string | null;
  review_inspector_id: string | null;
  reviewed_at: Date | null;
}

const mapQueueRow = (row: QueueRow): InspectorApplicationSummary => ({
  projectId: row.project_id,
  approvalId: row.approval_id,
  approvalKey: row.approval_key,
  approvalTitle: row.approval_title,
  enterpriseName: row.enterprise_name,
  applicantName: row.applicant_name,
  industry: row.industry,
  district: row.district,
  projectStatus: row.project_status,
  reviewStatus: row.review_status,
  submittedAt: row.submitted_at.toISOString(),
  attentionScore: row.attention_score,
  attentionLevel:
    row.attention_level === 'standard' ||
    row.attention_level === 'elevated' ||
    row.attention_level === 'high_attention'
      ? row.attention_level
      : null,
});

const mapApproval = (row: ApprovalRow): InspectorApproval => ({
  id: row.id,
  approvalKey: row.approval_key,
  title: row.title,
  requirementStatus: row.status,
  reviewStatus: row.review_status,
  decisionNote: row.decision_note,
  reviewStartedAt: row.review_started_at?.toISOString() ?? null,
  decidedAt: row.decided_at?.toISOString() ?? null,
  processingDays: row.processing_days,
  documents: row.documents,
});

const mapDocument = (row: DocumentRow): InspectorDocument => ({
  id: row.id,
  projectId: row.project_id,
  approvalKey: row.approval_key,
  documentKey: row.document_key,
  version: row.version,
  fileName: row.file_name,
  mimeType: row.mime_type,
  detectedMimeType: row.detected_mime_type,
  sizeBytes: Number(row.size_bytes),
  fileReadStatus: row.file_read_status,
  extractionStatus: row.extraction_status,
  expiresOn: row.expires_on?.toISOString().slice(0, 10) ?? null,
  createdAt: row.created_at.toISOString(),
  updatedAt: row.updated_at.toISOString(),
  review: {
    status: row.review_status ?? 'pending',
    comment: row.review_comment,
    inspectorId: row.review_inspector_id,
    reviewedAt: row.reviewed_at?.toISOString() ?? null,
  },
});

const mapClarifications = (
  rows: ClarificationRow[],
  responseRows: ClarificationResponseRow[],
): ClarificationRequest[] =>
  rows.map((row) => ({
    id: row.id,
    projectId: row.project_id,
    approvalId: row.approval_id,
    documentId: row.document_id,
    inspectorId: row.inspector_id,
    inspectorName: row.inspector_name,
    message: row.message,
    status: row.status,
    dueAt: row.due_at?.toISOString() ?? null,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    responses: responseRows
      .filter((response) => response.clarification_id === row.id)
      .map((response) => ({
        id: response.id,
        applicantId: response.applicant_id,
        applicantName: response.applicant_name,
        message: response.message,
        createdAt: response.created_at.toISOString(),
      })),
  }));

export class InspectorRepository {
  async listApplications(
    departmentId: string,
    filters: InspectorQueueQuery,
  ): Promise<{ items: InspectorApplicationSummary[]; total: number }> {
    const values: unknown[] = [departmentId];
    const where = [`pa.department_id = $1`, `p.status <> 'draft'`];
    if (filters.status) {
      values.push(filters.status);
      where.push(`pa.review_status = $${values.length}`);
    }
    if (filters.industry) {
      values.push(filters.industry);
      where.push(`p.industry = $${values.length}`);
    }
    if (filters.district) {
      values.push(filters.district);
      where.push(`p.district ILIKE $${values.length}`);
    }
    const countValues = [...values];
    values.push(filters.pageSize, (filters.page - 1) * filters.pageSize);
    const result = await query<QueueRow>(
      `SELECT p.id AS project_id, pa.id AS approval_id, pa.approval_key,
              pa.title AS approval_title, p.enterprise_name, u.name AS applicant_name,
              p.industry, p.district, p.status AS project_status, pa.review_status,
              COALESCE(p.submitted_at, p.created_at) AS submitted_at,
              p.attention_score, p.attention_level
       FROM project_approvals pa
       JOIN projects p ON p.id = pa.project_id
       JOIN users u ON u.id = p.applicant_id
       WHERE ${where.join(' AND ')}
       ORDER BY p.submitted_at ASC, pa.created_at ASC
       LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values,
    );
    const count = await query<{ total: string }>(
      `SELECT COUNT(*) AS total
       FROM project_approvals pa
       JOIN projects p ON p.id = pa.project_id
       WHERE ${where.join(' AND ')}`,
      countValues,
    );
    return { items: result.rows.map(mapQueueRow), total: Number(count.rows[0]?.total ?? 0) };
  }

  async findApplication(
    projectId: string,
    departmentId: string,
  ): Promise<InspectorApplicationDetail | null> {
    const projectResult = await query<DetailRow>(
      `SELECT p.id AS project_id, p.enterprise_name, p.industry, p.district,
              p.primary_activity, p.status AS project_status,
              COALESCE(p.submitted_at, p.created_at) AS submitted_at,
              p.details, u.id AS applicant_id, u.name AS applicant_name,
              u.phone_number AS applicant_phone
       FROM projects p
       JOIN users u ON u.id = p.applicant_id
       WHERE p.id = $1 AND p.status <> 'draft'
         AND EXISTS (SELECT 1 FROM project_approvals pa
                     WHERE pa.project_id = p.id AND pa.department_id = $2)`,
      [projectId, departmentId],
    );
    const project = projectResult.rows[0];
    if (!project) return null;
    const approvals = await query<ApprovalRow>(
      `SELECT id, approval_key, title, status, review_status, decision_note,
              review_started_at, decided_at, processing_days, documents
       FROM project_approvals
       WHERE project_id = $1 AND department_id = $2
       ORDER BY created_at`,
      [projectId, departmentId],
    );
    const documents = await query<DocumentRow>(
      `SELECT pd.id, pd.project_id, pd.approval_key, pd.document_key, pd.version,
              pd.file_name, pd.mime_type, pd.detected_mime_type, pd.size_bytes,
              pd.storage_key, pd.file_read_status, pd.extraction_status, pd.expires_on,
              pd.created_at, pd.updated_at, dr.status AS review_status,
              dr.comment AS review_comment, dr.inspector_id AS review_inspector_id,
              dr.reviewed_at
       FROM project_documents pd
       JOIN project_approvals pa
         ON pa.project_id = pd.project_id AND pa.approval_key = pd.approval_key
       LEFT JOIN document_reviews dr ON dr.document_id = pd.id
       WHERE pd.project_id = $1 AND pa.department_id = $2
       ORDER BY pd.approval_key, pd.document_key, pd.version DESC`,
      [projectId, departmentId],
    );
    const clarifications = await query<ClarificationRow>(
      `SELECT cr.id, cr.project_id, cr.approval_id, cr.document_id, cr.inspector_id,
              inspector.name AS inspector_name, cr.message, cr.status, cr.due_at,
              cr.created_at, cr.updated_at
       FROM clarification_requests cr
       JOIN project_approvals pa ON pa.id = cr.approval_id
       JOIN users inspector ON inspector.id = cr.inspector_id
       WHERE cr.project_id = $1 AND pa.department_id = $2
       ORDER BY cr.created_at DESC`,
      [projectId, departmentId],
    );
    const clarificationResponses = await query<ClarificationResponseRow>(
      `SELECT response.id, response.clarification_id, response.applicant_id,
              applicant.name AS applicant_name, response.message, response.created_at
       FROM clarification_responses response
       JOIN clarification_requests cr ON cr.id = response.clarification_id
       JOIN project_approvals pa ON pa.id = cr.approval_id
       JOIN users applicant ON applicant.id = response.applicant_id
       WHERE cr.project_id = $1 AND pa.department_id = $2
       ORDER BY response.created_at`,
      [projectId, departmentId],
    );
    return {
      projectId: project.project_id,
      enterpriseName: project.enterprise_name,
      industry: project.industry,
      district: project.district,
      primaryActivity: project.primary_activity,
      projectStatus: project.project_status,
      submittedAt: project.submitted_at.toISOString(),
      applicant: {
        id: project.applicant_id,
        name: project.applicant_name,
        phoneNumber: project.applicant_phone,
      },
      details: project.details,
      approvals: approvals.rows.map(mapApproval),
      documents: documents.rows.map(mapDocument),
      clarifications: mapClarifications(clarifications.rows, clarificationResponses.rows),
    };
  }

  async createClarification(input: {
    projectId: string;
    approvalId: string;
    departmentId: string;
    inspectorId: string;
    message: string;
    documentId?: string;
    dueAt?: string;
  }): Promise<boolean> {
    const result = await query(
      `INSERT INTO clarification_requests
         (project_id, approval_id, document_id, inspector_id, message, due_at)
       SELECT $1, pa.id, $5, $4, $6, $7
       FROM project_approvals pa
       WHERE pa.id = $2 AND pa.project_id = $1 AND pa.department_id = $3
         AND pa.review_status IN ('under_review', 'correction_required')
         AND ($5::uuid IS NULL OR EXISTS (
           SELECT 1 FROM project_documents pd
           WHERE pd.id = $5 AND pd.project_id = $1 AND pd.approval_key = pa.approval_key
         ))
       RETURNING id`,
      [
        input.projectId,
        input.approvalId,
        input.departmentId,
        input.inspectorId,
        input.documentId ?? null,
        input.message,
        input.dueAt ?? null,
      ],
    );
    return Boolean(result.rowCount);
  }

  async resolveClarification(input: {
    projectId: string;
    clarificationId: string;
    departmentId: string;
  }): Promise<boolean> {
    const result = await query(
      `UPDATE clarification_requests cr SET status = 'resolved'
       FROM project_approvals pa
       WHERE cr.id = $2 AND cr.project_id = $1 AND pa.id = cr.approval_id
         AND pa.department_id = $3 AND cr.status IN ('open', 'responded')
       RETURNING cr.id`,
      [input.projectId, input.clarificationId, input.departmentId],
    );
    return Boolean(result.rowCount);
  }

  async findDocumentForDepartment(
    projectId: string,
    documentId: string,
    departmentId: string,
  ): Promise<DocumentRow | null> {
    const result = await query<DocumentRow>(
      `SELECT pd.id, pd.project_id, pd.approval_key, pd.document_key, pd.version,
              pd.file_name, pd.mime_type, pd.detected_mime_type, pd.size_bytes,
              pd.storage_key, pd.file_read_status, pd.extraction_status, pd.expires_on,
              pd.created_at, pd.updated_at, dr.status AS review_status,
              dr.comment AS review_comment, dr.inspector_id AS review_inspector_id,
              dr.reviewed_at
       FROM project_documents pd
       JOIN project_approvals pa
         ON pa.project_id = pd.project_id AND pa.approval_key = pd.approval_key
       LEFT JOIN document_reviews dr ON dr.document_id = pd.id
       WHERE pd.project_id = $1 AND pd.id = $2 AND pa.department_id = $3
         AND EXISTS (SELECT 1 FROM projects p WHERE p.id = pd.project_id AND p.status <> 'draft')`,
      [projectId, documentId, departmentId],
    );
    return result.rows[0] ?? null;
  }

  async startReview(
    projectId: string,
    approvalId: string,
    departmentId: string,
    inspectorId: string,
  ): Promise<boolean> {
    const client = await databasePool.connect();
    try {
      await client.query('BEGIN');
      const updated = await client.query(
        `UPDATE project_approvals pa
         SET review_status = 'under_review',
             review_started_at = COALESCE(pa.review_started_at, NOW())
         FROM projects p
         WHERE pa.id = $2 AND pa.project_id = $1 AND pa.department_id = $3
           AND p.id = pa.project_id AND p.status IN ('submitted', 'under_review', 'correction_required')
           AND pa.review_status = 'pending'
         RETURNING pa.id`,
        [projectId, approvalId, departmentId],
      );
      if (!updated.rowCount) {
        await client.query('ROLLBACK');
        return false;
      }
      const project = await client.query<{ status: ProjectStatus }>(
        `UPDATE projects SET status = 'under_review', review_started_at = COALESCE(review_started_at, NOW())
         WHERE id = $1 RETURNING status`,
        [projectId],
      );
      await client.query(
        `INSERT INTO application_status_history
           (project_id, approval_id, actor_id, from_status, to_status, note)
         VALUES ($1, $2, $3, 'pending', 'under_review', 'Department review started')`,
        [projectId, approvalId, inspectorId],
      );
      await client.query('COMMIT');
      return Boolean(project.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async reviewDocument(input: {
    projectId: string;
    documentId: string;
    departmentId: string;
    inspectorId: string;
    status: Exclude<DocumentReviewStatus, 'pending'>;
    comment?: string;
  }): Promise<InspectorDocument | null> {
    const document = await this.findDocumentForDepartment(
      input.projectId,
      input.documentId,
      input.departmentId,
    );
    if (!document) return null;
    const approval = await query<{ id: string; review_status: ApprovalReviewStatus }>(
      `SELECT id, review_status FROM project_approvals
       WHERE project_id = $1 AND approval_key = $2 AND department_id = $3`,
      [input.projectId, document.approval_key, input.departmentId],
    );
    const assigned = approval.rows[0];
    if (!assigned || !['under_review', 'correction_required'].includes(assigned.review_status)) {
      return null;
    }
    await query(
      `INSERT INTO document_reviews
         (project_id, approval_id, document_id, inspector_id, status, comment)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (document_id) DO UPDATE
       SET inspector_id = EXCLUDED.inspector_id, status = EXCLUDED.status,
           comment = EXCLUDED.comment, reviewed_at = NOW()`,
      [
        input.projectId,
        assigned.id,
        input.documentId,
        input.inspectorId,
        input.status,
        input.comment ?? null,
      ],
    );
    const updated = await this.findDocumentForDepartment(
      input.projectId,
      input.documentId,
      input.departmentId,
    );
    return updated ? mapDocument(updated) : null;
  }

  async decideApproval(input: {
    projectId: string;
    approvalId: string;
    departmentId: string;
    inspectorId: string;
    decision: 'approved' | 'correction_required' | 'rejected';
    note?: string;
  }): Promise<InspectorApplicationDetail | null> {
    const client = await databasePool.connect();
    try {
      await client.query('BEGIN');
      const current = await client.query<{ review_status: ApprovalReviewStatus }>(
        `SELECT review_status FROM project_approvals
         WHERE id = $1 AND project_id = $2 AND department_id = $3 FOR UPDATE`,
        [input.approvalId, input.projectId, input.departmentId],
      );
      const fromStatus = current.rows[0]?.review_status;
      if (!fromStatus || !['under_review', 'correction_required'].includes(fromStatus)) {
        await client.query('ROLLBACK');
        return null;
      }
      await client.query(
        `UPDATE project_approvals
         SET review_status = $4::approval_review_status, decision_note = $5, decided_by = $6,
             decided_at = CASE WHEN $4::text = 'correction_required' THEN NULL ELSE NOW() END
         WHERE id = $2 AND project_id = $1 AND department_id = $3`,
        [
          input.projectId,
          input.approvalId,
          input.departmentId,
          input.decision,
          input.note ?? null,
          input.inspectorId,
        ],
      );
      const statuses = await client.query<{ review_status: ApprovalReviewStatus }>(
        `SELECT review_status FROM project_approvals WHERE project_id = $1`,
        [input.projectId],
      );
      const all = statuses.rows.map((row) => row.review_status);
      const projectStatus: ProjectStatus = all.includes('rejected')
        ? 'rejected'
        : all.includes('correction_required')
          ? 'correction_required'
          : all.every((status) => status === 'approved')
            ? 'approved'
            : 'under_review';
      await client.query(
        `UPDATE projects SET status = $2::project_status,
           decided_at = CASE WHEN $2::text IN ('approved', 'rejected') THEN NOW() ELSE NULL END
         WHERE id = $1`,
        [input.projectId, projectStatus],
      );
      await client.query(
        `INSERT INTO application_status_history
           (project_id, approval_id, actor_id, from_status, to_status, note)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          input.projectId,
          input.approvalId,
          input.inspectorId,
          fromStatus,
          input.decision,
          input.note ?? null,
        ],
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    return this.findApplication(input.projectId, input.departmentId);
  }
}
