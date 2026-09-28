export type DocumentReadStatus = 'not_checked' | 'readable' | 'unreadable' | 'password_protected';

export type DocumentExtractionStatus = 'not_run' | 'succeeded' | 'failed' | 'review_required';

export type DocumentStorageStatus = 'pending' | 'stored' | 'failed';

export interface ProjectDocumentRecord {
  id: string;
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
  extractionStatus: DocumentExtractionStatus;
  storageStatus: DocumentStorageStatus;
  expiresOn: string | null;
  createdAt: string;
  updatedAt: string;
}
