import { databasePool, query } from '../../database/database.js';
import type {
  DocumentExtractionStatus,
  DocumentReadStatus,
  ProjectDocumentRecord,
} from './document.types.js';

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
}

const mapRow = (row: DocumentRow): ProjectDocumentRecord => ({
  id: row.id,
  projectId: row.project_id,
  approvalKey: row.approval_key,
  documentKey: row.document_key,
  version: row.version,
  fileName: row.file_name,
  mimeType: row.mime_type,
  detectedMimeType: row.detected_mime_type,
  sizeBytes: Number(row.size_bytes),
  storageKey: row.storage_key,
  fileReadStatus: row.file_read_status,
  extractionStatus: row.extraction_status,
  expiresOn: row.expires_on ? row.expires_on.toISOString().slice(0, 10) : null,
  createdAt: row.created_at.toISOString(),
  updatedAt: row.updated_at.toISOString(),
});

export interface CreateDocumentInput {
  projectId: string;
  approvalKey: string;
  documentKey: string;
  version: number;
  fileName: string;
  mimeType: string;
  detectedMimeType: string | null;
  sizeBytes: number;
  storageKey: string;
  fileReadStatus: DocumentReadStatus;
  uploadedBy: string;
}

export class DocumentRepository {
  async findLatestReview(
    projectId: string,
    approvalKey: string,
    documentKey: string,
  ): Promise<{ documentId: string; status: string; comment: string | null } | null> {
    const result = await query<{ document_id: string; status: string; comment: string | null }>(
      `SELECT pd.id AS document_id, COALESCE(dr.status::text, 'pending') AS status, dr.comment
       FROM project_documents pd
       LEFT JOIN document_reviews dr ON dr.document_id = pd.id
       WHERE pd.project_id = $1 AND pd.approval_key = $2 AND pd.document_key = $3
       ORDER BY pd.version DESC LIMIT 1`,
      [projectId, approvalKey, documentKey],
    );
    const row = result.rows[0];
    return row ? { documentId: row.document_id, status: row.status, comment: row.comment } : null;
  }

  async nextVersion(projectId: string, approvalKey: string, documentKey: string): Promise<number> {
    const result = await query<{ next: number }>(
      `SELECT COALESCE(MAX(version), 0) + 1 AS next
       FROM project_documents
       WHERE project_id = $1 AND approval_key = $2 AND document_key = $3`,
      [projectId, approvalKey, documentKey],
    );
    return result.rows[0]?.next ?? 1;
  }

  async create(input: CreateDocumentInput): Promise<ProjectDocumentRecord> {
    const result = await query<DocumentRow>(
      `INSERT INTO project_documents
         (project_id, approval_key, document_key, version, file_name, mime_type,
          detected_mime_type, size_bytes, storage_key, file_read_status, uploaded_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id, project_id, approval_key, document_key, version, file_name, mime_type,
                 detected_mime_type, size_bytes, storage_key, file_read_status, extraction_status,
                 expires_on, created_at, updated_at`,
      [
        input.projectId,
        input.approvalKey,
        input.documentKey,
        input.version,
        input.fileName,
        input.mimeType,
        input.detectedMimeType,
        input.sizeBytes,
        input.storageKey,
        input.fileReadStatus,
        input.uploadedBy,
      ],
    );
    return mapRow(result.rows[0]!);
  }

  async findByProject(projectId: string): Promise<ProjectDocumentRecord[]> {
    const result = await query<DocumentRow>(
      `SELECT id, project_id, approval_key, document_key, version, file_name, mime_type,
              detected_mime_type, size_bytes, storage_key, file_read_status, extraction_status,
              expires_on, created_at, updated_at
       FROM project_documents
       WHERE project_id = $1
       ORDER BY approval_key, document_key, version`,
      [projectId],
    );
    return result.rows.map(mapRow);
  }

  async findById(projectId: string, documentId: string): Promise<ProjectDocumentRecord | null> {
    const result = await query<DocumentRow>(
      `SELECT id, project_id, approval_key, document_key, version, file_name, mime_type,
              detected_mime_type, size_bytes, storage_key, file_read_status, extraction_status,
              expires_on, created_at, updated_at
       FROM project_documents
       WHERE project_id = $1 AND id = $2`,
      [projectId, documentId],
    );
    return result.rows[0] ? mapRow(result.rows[0]) : null;
  }

  async deleteById(projectId: string, documentId: string): Promise<boolean> {
    const result = await query(`DELETE FROM project_documents WHERE project_id = $1 AND id = $2`, [
      projectId,
      documentId,
    ]);
    return (result.rowCount ?? 0) > 0;
  }

  async markCorrectionResubmitted(input: {
    projectId: string;
    approvalKey: string;
    applicantId: string;
  }): Promise<void> {
    const client = await databasePool.connect();
    try {
      await client.query('BEGIN');
      const approval = await client.query<{ id: string; review_status: string }>(
        `SELECT id, review_status FROM project_approvals
         WHERE project_id = $1 AND approval_key = $2 FOR UPDATE`,
        [input.projectId, input.approvalKey],
      );
      const current = approval.rows[0];
      if (!current || current.review_status !== 'correction_required') {
        await client.query('COMMIT');
        return;
      }
      const outstanding = await client.query(
        `SELECT 1
         FROM project_documents pd
         LEFT JOIN document_reviews dr ON dr.document_id = pd.id
         WHERE pd.project_id = $1 AND pd.approval_key = $2
           AND pd.version = (
             SELECT MAX(latest.version) FROM project_documents latest
             WHERE latest.project_id = pd.project_id
               AND latest.approval_key = pd.approval_key
               AND latest.document_key = pd.document_key
           )
           AND dr.status IN ('correction_required', 'rejected')
         LIMIT 1`,
        [input.projectId, input.approvalKey],
      );
      if (!outstanding.rowCount) {
        await client.query(
          `UPDATE project_approvals
           SET review_status = 'under_review', decision_note = NULL, decided_at = NULL
           WHERE id = $1`,
          [current.id],
        );
        const remainingCorrections = await client.query(
          `SELECT 1 FROM project_approvals
           WHERE project_id = $1 AND review_status = 'correction_required' LIMIT 1`,
          [input.projectId],
        );
        if (!remainingCorrections.rowCount) {
          await client.query(`UPDATE projects SET status = 'under_review' WHERE id = $1`, [
            input.projectId,
          ]);
        }
        await client.query(
          `INSERT INTO application_status_history
             (project_id, approval_id, actor_id, from_status, to_status, note)
           VALUES ($1, $2, $3, 'correction_required', 'under_review',
                   'Corrected document version submitted for review')`,
          [input.projectId, current.id, input.applicantId],
        );
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
