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
  AttentionAssessment,
  AttentionFactor,
  AttentionLevel,
  DocumentReviewStatus,
  ClarificationRequest,
  ClarificationStatus,
  InspectionOutcome,
  InspectionStatus,
  InspectionSummary,
  InspectorApplicationDetail,
  InspectorApplicationSummary,
  InspectorApproval,
  InspectorClarificationSummary,
  InspectorDecisionSummary,
  InspectorDocument,
  InspectorReport,
  ValidationCheckStatus,
  ValidationDocumentCheck,
  ValidationFlag,
  ValidationFlags,
} from './inspector.types.js';

const ATTENTION_LEVELS = ['standard', 'elevated', 'high_attention'] as const;

const toAttentionLevel = (value: string | null): AttentionLevel | null =>
  (ATTENTION_LEVELS as readonly string[]).includes(value ?? '')
    ? (value as AttentionLevel)
    : null;

/** Coerce the persisted jsonb factors back into a typed, validated list. */
const toAttentionFactors = (value: unknown): AttentionFactor[] => {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const factor = item as Record<string, unknown>;
    if (
      typeof factor.code === 'string' &&
      typeof factor.label === 'string' &&
      typeof factor.points === 'number' &&
      typeof factor.explanation === 'string'
    ) {
      return [
        {
          code: factor.code,
          label: factor.label,
          points: factor.points,
          explanation: factor.explanation,
        },
      ];
    }
    return [];
  });
};

const toAttentionAssessment = (
  score: number | null,
  level: string | null,
  factors: unknown,
): AttentionAssessment | null => {
  const normalisedLevel = toAttentionLevel(level);
  if (score === null || normalisedLevel === null) return null;
  return { score, level: normalisedLevel, factors: toAttentionFactors(factors) };
};

const asString = (value: unknown): string => (typeof value === 'string' ? value : '');
const asNullableString = (value: unknown): string | null =>
  typeof value === 'string' ? value : null;

const CHECK_STATUSES: readonly string[] = [
  'matched',
  'mismatched',
  'unavailable',
  'review_required',
];

const toValidationFlag = (item: Record<string, unknown>): ValidationFlag => ({
  code: asString(item.code),
  message: asString(item.message),
  suggestedAction: asString(item.suggestedAction),
  approvalKey: asNullableString(item.approvalKey),
  documentKey: asNullableString(item.documentKey),
  field: asNullableString(item.field),
});

const toValidationFlagList = (value: unknown): ValidationFlag[] =>
  Array.isArray(value)
    ? value.flatMap((item) =>
        item && typeof item === 'object' ? [toValidationFlag(item as Record<string, unknown>)] : [],
      )
    : [];

const toDocumentChecks = (value: unknown): ValidationDocumentCheck[] =>
  Array.isArray(value)
    ? value.flatMap((item) => {
        if (!item || typeof item !== 'object') return [];
        const check = item as Record<string, unknown>;
        const status = asString(check.status);
        if (!CHECK_STATUSES.includes(status)) return [];
        return [
          {
            approvalKey: asString(check.approvalKey),
            documentKey: asString(check.documentKey),
            field: asNullableString(check.field),
            status: status as ValidationCheckStatus,
            reason: asString(check.reason),
          },
        ];
      })
    : [];

/** Coerce the persisted jsonb validation snapshot back into typed flags. */
const toValidationFlags = (value: unknown): ValidationFlags | null => {
  if (!value || typeof value !== 'object') return null;
  const snapshot = value as Record<string, unknown>;
  return {
    warnings: toValidationFlagList(snapshot.warnings),
    reviewItems: toValidationFlagList(snapshot.reviewItems),
    documentChecks: toDocumentChecks(snapshot.documentChecks),
  };
};

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
  due_at: Date | null;
  overdue: boolean;
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
  attention_score: number | null;
  attention_level: string | null;
  attention_factors: unknown;
  validation_flags: unknown;
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
  dueAt: row.due_at?.toISOString() ?? null,
  overdue: row.overdue,
  attentionScore: row.attention_score,
  attentionLevel: toAttentionLevel(row.attention_level),
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

interface InspectionRow {
  id: string;
  project_id: string;
  approval_id: string;
  approval_title: string;
  enterprise_name: string;
  district: string;
  scheduled_at: Date;
  status: InspectionStatus;
  outcome: InspectionOutcome | null;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
}

const INSPECTION_SELECT = `
  SELECT i.id, i.project_id, i.approval_id, pa.title AS approval_title,
         p.enterprise_name, p.district, i.scheduled_at, i.status, i.outcome,
         i.notes, i.created_at, i.updated_at
    FROM inspections i
    JOIN project_approvals pa ON pa.id = i.approval_id
    JOIN projects p ON p.id = i.project_id`;

const mapInspection = (row: InspectionRow): InspectionSummary => ({
  id: row.id,
  projectId: row.project_id,
  approvalId: row.approval_id,
  approvalTitle: row.approval_title,
  enterpriseName: row.enterprise_name,
  district: row.district,
  scheduledAt: row.scheduled_at.toISOString(),
  status: row.status,
  outcome: row.outcome,
  notes: row.notes,
  createdAt: row.created_at.toISOString(),
  updatedAt: row.updated_at.toISOString(),
});

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
    if (filters.q) {
      values.push(`%${filters.q}%`);
      where.push(
        `(p.enterprise_name ILIKE $${values.length} OR u.name ILIKE $${values.length} OR p.id::text ILIKE $${values.length})`,
      );
    }
    const countValues = [...values];
    values.push(filters.pageSize, (filters.page - 1) * filters.pageSize);
    const result = await query<QueueRow>(
      `SELECT p.id AS project_id, pa.id AS approval_id, pa.approval_key,
              pa.title AS approval_title, p.enterprise_name, u.name AS applicant_name,
              p.industry, p.district, p.status AS project_status, pa.review_status,
              COALESCE(p.submitted_at, p.created_at) AS submitted_at,
              COALESCE(p.submitted_at, p.created_at)
                + make_interval(days => pa.processing_days) AS due_at,
              (COALESCE(p.submitted_at, p.created_at)
                + make_interval(days => pa.processing_days) < now()
                AND pa.review_status NOT IN ('approved', 'rejected')) AS overdue,
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
       JOIN users u ON u.id = p.applicant_id
       WHERE ${where.join(' AND ')}`,
      countValues,
    );
    return { items: result.rows.map(mapQueueRow), total: Number(count.rows[0]?.total ?? 0) };
  }

  async listClarifications(departmentId: string): Promise<InspectorClarificationSummary[]> {
    const result = await query<{
      id: string;
      project_id: string;
      approval_id: string;
      approval_title: string;
      enterprise_name: string;
      applicant_name: string;
      district: string;
      message: string;
      status: ClarificationStatus;
      due_at: Date | null;
      created_at: Date;
      updated_at: Date;
      response_count: string;
      latest_response_at: Date | null;
    }>(
      `SELECT cr.id, cr.project_id, cr.approval_id, pa.title AS approval_title,
              p.enterprise_name, p.district, applicant.name AS applicant_name,
              cr.message, cr.status, cr.due_at, cr.created_at, cr.updated_at,
              (SELECT COUNT(*) FROM clarification_responses resp
                 WHERE resp.clarification_id = cr.id) AS response_count,
              (SELECT MAX(resp.created_at) FROM clarification_responses resp
                 WHERE resp.clarification_id = cr.id) AS latest_response_at
         FROM clarification_requests cr
         JOIN project_approvals pa ON pa.id = cr.approval_id
         JOIN projects p ON p.id = cr.project_id
         JOIN users applicant ON applicant.id = p.applicant_id
        WHERE pa.department_id = $1
        ORDER BY cr.updated_at DESC`,
      [departmentId],
    );
    return result.rows.map((row) => ({
      id: row.id,
      projectId: row.project_id,
      approvalId: row.approval_id,
      approvalTitle: row.approval_title,
      enterpriseName: row.enterprise_name,
      applicantName: row.applicant_name,
      district: row.district,
      message: row.message,
      status: row.status,
      dueAt: row.due_at?.toISOString() ?? null,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
      responseCount: Number(row.response_count),
      latestResponseAt: row.latest_response_at?.toISOString() ?? null,
    }));
  }

  async listDecisions(departmentId: string): Promise<InspectorDecisionSummary[]> {
    const result = await query<{
      project_id: string;
      approval_id: string;
      approval_key: string;
      approval_title: string;
      enterprise_name: string;
      applicant_name: string;
      district: string;
      review_status: ApprovalReviewStatus;
      decision_note: string | null;
      decided_at: Date | null;
      decided_by_name: string | null;
      submitted_at: Date;
    }>(
      `SELECT p.id AS project_id, pa.id AS approval_id, pa.approval_key,
              pa.title AS approval_title, p.enterprise_name, p.district,
              applicant.name AS applicant_name, pa.review_status, pa.decision_note,
              pa.decided_at, decider.name AS decided_by_name,
              COALESCE(p.submitted_at, p.created_at) AS submitted_at
         FROM project_approvals pa
         JOIN projects p ON p.id = pa.project_id
         JOIN users applicant ON applicant.id = p.applicant_id
         LEFT JOIN users decider ON decider.id = pa.decided_by
        WHERE pa.department_id = $1 AND p.status <> 'draft'
        ORDER BY (pa.review_status IN ('under_review', 'correction_required')) DESC,
                 pa.decided_at DESC NULLS LAST, submitted_at ASC`,
      [departmentId],
    );
    return result.rows.map((row) => ({
      projectId: row.project_id,
      approvalId: row.approval_id,
      approvalKey: row.approval_key,
      approvalTitle: row.approval_title,
      enterpriseName: row.enterprise_name,
      applicantName: row.applicant_name,
      district: row.district,
      reviewStatus: row.review_status,
      decisionNote: row.decision_note,
      decidedAt: row.decided_at?.toISOString() ?? null,
      decidedByName: row.decided_by_name,
      submittedAt: row.submitted_at.toISOString(),
    }));
  }

  async getReport(departmentId: string): Promise<InspectorReport> {
    const [statusRows, avgRow, approvalRows, inspectionRows, clarificationRows] = await Promise.all([
      query<{ review_status: string; count: string }>(
        `SELECT pa.review_status, COUNT(*) AS count
           FROM project_approvals pa JOIN projects p ON p.id = pa.project_id
          WHERE pa.department_id = $1 AND p.status <> 'draft'
          GROUP BY pa.review_status`,
        [departmentId],
      ),
      query<{ avg_days: string | null }>(
        `SELECT AVG(EXTRACT(EPOCH FROM (pa.decided_at - COALESCE(p.submitted_at, p.created_at))) / 86400)
                  AS avg_days
           FROM project_approvals pa JOIN projects p ON p.id = pa.project_id
          WHERE pa.department_id = $1 AND pa.decided_at IS NOT NULL`,
        [departmentId],
      ),
      query<{ approval_key: string; title: string; total: string; approved: string }>(
        `SELECT pa.approval_key, pa.title, COUNT(*) AS total,
                COUNT(*) FILTER (WHERE pa.review_status = 'approved') AS approved
           FROM project_approvals pa JOIN projects p ON p.id = pa.project_id
          WHERE pa.department_id = $1 AND p.status <> 'draft'
          GROUP BY pa.approval_key, pa.title
          ORDER BY total DESC`,
        [departmentId],
      ),
      query<{ status: string; count: string }>(
        `SELECT status, COUNT(*) AS count FROM inspections
          WHERE department_id = $1 GROUP BY status`,
        [departmentId],
      ),
      query<{ status: string; count: string }>(
        `SELECT cr.status, COUNT(*) AS count
           FROM clarification_requests cr JOIN project_approvals pa ON pa.id = cr.approval_id
          WHERE pa.department_id = $1 GROUP BY cr.status`,
        [departmentId],
      ),
    ]);

    const countOf = <T extends { count: string }>(rows: T[], match: (row: T) => boolean) =>
      Number(rows.find(match)?.count ?? 0);

    const status = (value: string) =>
      countOf(statusRows.rows, (row) => row.review_status === value);
    const inspectionOf = (value: string) =>
      countOf(inspectionRows.rows, (row) => row.status === value);
    const clarificationOf = (value: string) =>
      countOf(clarificationRows.rows, (row) => row.status === value);

    const approved = status('approved');
    const rejected = status('rejected');
    const avgDays = avgRow.rows[0]?.avg_days;

    return {
      totals: {
        assigned: statusRows.rows.reduce((sum, row) => sum + Number(row.count), 0),
        pending: status('pending'),
        underReview: status('under_review'),
        correctionRequired: status('correction_required'),
        approved,
        rejected,
        decided: approved + rejected,
      },
      averageDecisionDays: avgDays === null || avgDays === undefined ? null : Number(avgDays),
      byApproval: approvalRows.rows.map((row) => ({
        approvalKey: row.approval_key,
        approvalTitle: row.title,
        total: Number(row.total),
        approved: Number(row.approved),
      })),
      inspections: {
        scheduled: inspectionOf('scheduled'),
        completed: inspectionOf('completed'),
        cancelled: inspectionOf('cancelled'),
      },
      clarifications: {
        open: clarificationOf('open'),
        responded: clarificationOf('responded'),
        resolved: clarificationOf('resolved'),
      },
    };
  }

  async listInspections(departmentId: string): Promise<InspectionSummary[]> {
    const result = await query<InspectionRow>(
      `${INSPECTION_SELECT} WHERE i.department_id = $1 ORDER BY i.scheduled_at DESC`,
      [departmentId],
    );
    return result.rows.map(mapInspection);
  }

  /** True only when the approval belongs to this project and this department. */
  async approvalInDepartment(
    projectId: string,
    approvalId: string,
    departmentId: string,
  ): Promise<boolean> {
    const result = await query(
      `SELECT 1 FROM project_approvals
        WHERE id = $1 AND project_id = $2 AND department_id = $3`,
      [approvalId, projectId, departmentId],
    );
    return result.rows.length > 0;
  }

  async scheduleInspection(input: {
    projectId: string;
    approvalId: string;
    departmentId: string;
    scheduledAt: string;
    notes?: string | null;
    createdBy: string;
  }): Promise<InspectionSummary> {
    const inserted = await query<{ id: string }>(
      `INSERT INTO inspections
         (project_id, approval_id, department_id, scheduled_at, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [
        input.projectId,
        input.approvalId,
        input.departmentId,
        input.scheduledAt,
        input.notes ?? null,
        input.createdBy,
      ],
    );
    const result = await query<InspectionRow>(`${INSPECTION_SELECT} WHERE i.id = $1`, [
      inserted.rows[0]!.id,
    ]);
    return mapInspection(result.rows[0]!);
  }

  async updateInspection(input: {
    inspectionId: string;
    departmentId: string;
    status?: InspectionStatus | undefined;
    outcome?: InspectionOutcome | null | undefined;
    scheduledAt?: string | undefined;
    notes?: string | null | undefined;
  }): Promise<InspectionSummary | null> {
    const sets: string[] = [];
    const values: unknown[] = [];
    const set = (column: string, value: unknown) => {
      values.push(value);
      sets.push(`${column} = $${values.length}`);
    };
    if (input.status !== undefined) set('status', input.status);
    if (input.outcome !== undefined) set('outcome', input.outcome);
    if (input.scheduledAt !== undefined) set('scheduled_at', input.scheduledAt);
    if (input.notes !== undefined) set('notes', input.notes);
    if (sets.length === 0) {
      const current = await query<InspectionRow>(
        `${INSPECTION_SELECT} WHERE i.id = $1 AND i.department_id = $2`,
        [input.inspectionId, input.departmentId],
      );
      return current.rows[0] ? mapInspection(current.rows[0]) : null;
    }
    values.push(input.inspectionId, input.departmentId);
    const updated = await query<{ id: string }>(
      `UPDATE inspections SET ${sets.join(', ')}
        WHERE id = $${values.length - 1} AND department_id = $${values.length}
        RETURNING id`,
      values,
    );
    if (updated.rows.length === 0) return null;
    const result = await query<InspectionRow>(`${INSPECTION_SELECT} WHERE i.id = $1`, [
      input.inspectionId,
    ]);
    return mapInspection(result.rows[0]!);
  }

  async findApplication(
    projectId: string,
    departmentId: string,
  ): Promise<InspectorApplicationDetail | null> {
    const projectResult = await query<DetailRow>(
      `SELECT p.id AS project_id, p.enterprise_name, p.industry, p.district,
              p.primary_activity, p.status AS project_status,
              COALESCE(p.submitted_at, p.created_at) AS submitted_at,
              p.attention_score, p.attention_level, p.attention_factors,
              p.validation_flags,
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
      attention: toAttentionAssessment(
        project.attention_score,
        project.attention_level,
        project.attention_factors,
      ),
      validation: toValidationFlags(project.validation_flags),
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
