import { query } from '../../database/database.js';
import type {
  DocumentExtractionStatus,
  DocumentReadStatus,
  DocumentStorageStatus,
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
  storage_status: DocumentStorageStatus;
  expires_on: Date | null;
  created_at: Date;
  updated_at: Date;
}

// A DATE column comes back from node-postgres as a JS Date at LOCAL midnight, so
// toISOString() (UTC) can shift it to the previous day. Format from local parts.
const toDateString = (value: Date): string => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

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
  storageStatus: row.storage_status,
  expiresOn: row.expires_on ? toDateString(row.expires_on) : null,
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
  storageStatus?: DocumentStorageStatus;
  uploadedBy: string;
  expiresOn?: string | null;
}

export class DocumentRepository {
  async findLatestReview(
    projectId: string,
    approvalKey: string,
    documentKey: string,
  ): Promise<{ documentId: string; status: string; comment: string | null } | null> {
    const result = await query<{ document_id: string; status: string; comment: string | null }>(
      `SELECT pd.id AS document_id, dr.status::text AS status, dr.comment
       FROM project_documents pd
       JOIN document_reviews dr ON dr.document_id = pd.id
       WHERE pd.project_id = $1 AND pd.approval_key = $2 AND pd.document_key = $3
         AND dr.status IN ('correction_required', 'rejected')
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
          detected_mime_type, size_bytes, storage_key, file_read_status, storage_status,
          uploaded_by, expires_on)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING id, project_id, approval_key, document_key, version, file_name, mime_type,
                 detected_mime_type, size_bytes, storage_key, file_read_status, extraction_status, storage_status,
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
        input.storageStatus ?? 'stored',
        input.uploadedBy,
        input.expiresOn ?? null,
      ],
    );
    return mapRow(result.rows[0]!);
  }

  async markStorageStatus(documentId: string, status: DocumentStorageStatus): Promise<void> {
    await query(`UPDATE project_documents SET storage_status = $2 WHERE id = $1`, [
      documentId,
      status,
    ]);
  }

  async findByProject(projectId: string): Promise<ProjectDocumentRecord[]> {
    const result = await query<DocumentRow>(
      `SELECT id, project_id, approval_key, document_key, version, file_name, mime_type,
              detected_mime_type, size_bytes, storage_key, file_read_status, extraction_status, storage_status,
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
              detected_mime_type, size_bytes, storage_key, file_read_status, extraction_status, storage_status,
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
}
