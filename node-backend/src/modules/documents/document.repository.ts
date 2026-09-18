import { query } from '../../database/database.js';
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
}
