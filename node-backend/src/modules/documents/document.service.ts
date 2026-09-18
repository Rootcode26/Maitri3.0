import { randomUUID } from 'node:crypto';

import { DatabaseError } from 'pg';

import { logger } from '../../config/logger.js';
import { AppError } from '../../errors/app-error.js';
import type { MalwareScanner } from '../../integrations/clamav/scanner.js';
import type { ObjectStorage } from '../../integrations/s3/storage.js';
import type { ProjectRepository } from '../projects/project.repository.js';
import {
  allowedMimeTypesForFormats,
  determineReadStatus,
  inspectFileContent,
} from './document.content-inspection.js';
import type { DocumentRepository } from './document.repository.js';
import type { UploadDocumentInput } from './document.schemas.js';
import type { ProjectDocumentRecord } from './document.types.js';
import {
  ValidationEngineError,
  type ValidationClient,
  type ValidationResult,
} from './document.validation-client.js';

const DEFAULT_FORMATS = ['PDF', 'JPG', 'PNG'] as const;

export interface UploadedFile {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
  size: number;
}

const sanitizeFileName = (name: string): string =>
  name
    .split(/[/\\]/)
    .pop()!
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(0, 200) || 'file';

export class DocumentService {
  constructor(
    private readonly projectRepository: ProjectRepository,
    private readonly documentRepository: DocumentRepository,
    private readonly storage: ObjectStorage | null,
    private readonly scanner: MalwareScanner | null,
    private readonly validationClient: ValidationClient | null,
    private readonly options: {
      defaultMaxSizeMb: number;
      rulesVersion: string;
      includeDocumentBytes: boolean;
    },
  ) {}

  private async ownedProject(applicantId: string, projectId: string) {
    const project = await this.projectRepository.findProjectById(projectId);
    if (!project || project.applicantId !== applicantId) {
      throw new AppError('Project not found', { statusCode: 404, code: 'PROJECT_NOT_FOUND' });
    }
    return project;
  }

  async uploadDocument(
    applicantId: string,
    projectId: string,
    input: UploadDocumentInput,
    file: UploadedFile,
  ): Promise<ProjectDocumentRecord> {
    if (!this.storage) {
      throw new AppError('Document uploads are not configured', {
        statusCode: 503,
        code: 'UPLOADS_NOT_CONFIGURED',
      });
    }

    const project = await this.ownedProject(applicantId, projectId);
    const approval = project.approvals.find((a) => a.approvalKey === input.approvalKey);
    if (!approval) {
      throw new AppError('Approval not found for this project', {
        statusCode: 404,
        code: 'APPROVAL_NOT_FOUND',
      });
    }
    const spec = approval.documents.find((doc) => doc.key === input.documentKey);
    if (!spec) {
      throw new AppError('Document is not part of this approval', {
        statusCode: 404,
        code: 'DOCUMENT_NOT_FOUND',
      });
    }

    const maxSizeMb = spec.maxSizeMb ?? this.options.defaultMaxSizeMb;
    if (file.size > Math.round(maxSizeMb * 1_000_000)) {
      throw new AppError(`File must be ${maxSizeMb} MB or smaller`, {
        statusCode: 400,
        code: 'FILE_TOO_LARGE',
      });
    }

    const formats = spec.formats?.length ? spec.formats : [...DEFAULT_FORMATS];
    const { detectedMimeType } = await inspectFileContent(file.buffer);
    const allowed = allowedMimeTypesForFormats(formats);
    if (!detectedMimeType || !allowed.has(detectedMimeType)) {
      throw new AppError(`File must be one of: ${formats.join(', ')}`, {
        statusCode: 400,
        code: 'UNSUPPORTED_FILE_TYPE',
        details: { detectedMimeType },
      });
    }

    if (this.scanner) {
      let scan;
      try {
        scan = await this.scanner.scan(file.buffer);
      } catch (error) {
        logger.error({ err: error }, 'Malware scan failed; rejecting the upload');
        throw new AppError('Upload scanning is temporarily unavailable', {
          statusCode: 503,
          code: 'SCAN_UNAVAILABLE',
        });
      }
      if (!scan.clean) {
        logger.warn({ signature: scan.signature }, 'Rejected an upload flagged by the scanner');
        throw new AppError('The file did not pass a security scan', {
          statusCode: 400,
          code: 'MALWARE_DETECTED',
        });
      }
    }

    const fileReadStatus = determineReadStatus(file.buffer, detectedMimeType);

    const version = await this.documentRepository.nextVersion(
      projectId,
      input.approvalKey,
      input.documentKey,
    );
    const storageKey = `projects/${projectId}/${input.approvalKey}/${input.documentKey}/${randomUUID()}-${sanitizeFileName(file.originalName)}`;

    await this.storage.put(storageKey, file.buffer, detectedMimeType);
    try {
      return await this.documentRepository.create({
        projectId,
        approvalKey: input.approvalKey,
        documentKey: input.documentKey,
        version,
        fileName: sanitizeFileName(file.originalName),
        mimeType: file.mimeType,
        detectedMimeType,
        sizeBytes: file.size,
        storageKey,
        fileReadStatus,
        uploadedBy: applicantId,
      });
    } catch (error) {
      await this.storage.delete(storageKey).catch((cleanupError) => {
        logger.warn({ err: cleanupError, storageKey }, 'Failed to clean up orphaned upload');
      });
      if (error instanceof DatabaseError && error.code === '23505') {
        throw new AppError('This document was updated at the same time. Please try again.', {
          statusCode: 409,
          code: 'DOCUMENT_VERSION_CONFLICT',
        });
      }
      throw error;
    }
  }

  async listDocuments(applicantId: string, projectId: string): Promise<ProjectDocumentRecord[]> {
    await this.ownedProject(applicantId, projectId);
    return this.documentRepository.findByProject(projectId);
  }

  async deleteDocument(applicantId: string, projectId: string, documentId: string): Promise<void> {
    await this.ownedProject(applicantId, projectId);
    const document = await this.documentRepository.findById(projectId, documentId);
    if (!document) {
      throw new AppError('Document not found', { statusCode: 404, code: 'DOCUMENT_NOT_FOUND' });
    }
    await this.documentRepository.deleteById(projectId, documentId);
    if (this.storage) {
      await this.storage.delete(document.storageKey).catch((error) => {
        logger.warn(
          { err: error, storageKey: document.storageKey },
          'Failed to delete stored object',
        );
      });
    }
  }

  async getDownloadUrl(
    applicantId: string,
    projectId: string,
    documentId: string,
  ): Promise<string> {
    if (!this.storage) {
      throw new AppError('Document storage is not configured', {
        statusCode: 503,
        code: 'UPLOADS_NOT_CONFIGURED',
      });
    }
    await this.ownedProject(applicantId, projectId);
    const document = await this.documentRepository.findById(projectId, documentId);
    if (!document) {
      throw new AppError('Document not found', { statusCode: 404, code: 'DOCUMENT_NOT_FOUND' });
    }
    return this.storage.signedGetUrl(document.storageKey, document.fileName);
  }

  async validateProject(applicantId: string, projectId: string): Promise<ValidationResult> {
    if (!this.validationClient) {
      throw new AppError('Document validation is not configured', {
        statusCode: 503,
        code: 'VALIDATION_NOT_CONFIGURED',
      });
    }
    const project = await this.ownedProject(applicantId, projectId);
    const stored = await this.documentRepository.findByProject(projectId);

    const latest = new Map<string, (typeof stored)[number]>();
    for (const document of stored) {
      const key = `${document.approvalKey}:${document.documentKey}`;
      const existing = latest.get(key);
      if (!existing || document.version > existing.version) latest.set(key, document);
    }
    const current = [...latest.values()];

    const includeBytes = this.options.includeDocumentBytes && this.storage !== null;

    let documents;
    try {
      documents = await Promise.all(
        current.map(async (document) => {
          const payload = {
            documentId: document.id,
            version: document.version,
            approvalKey: document.approvalKey,
            documentKey: document.documentKey,
            fileName: document.fileName,
            mimeType: document.mimeType,
            detectedMimeType: document.detectedMimeType,
            sizeBytes: document.sizeBytes,
            storageKey: null,
            fileReadStatus: document.fileReadStatus,
            extractionStatus: document.extractionStatus,
            extractedData: null,
            expiresOn: document.expiresOn,
          };
          if (includeBytes && this.storage) {
            const bytes = await this.storage.get(document.storageKey);
            return { ...payload, content: bytes.toString('base64') };
          }
          return payload;
        }),
      );
    } catch (error) {
      logger.error({ err: error }, 'Failed to read a stored document for validation');
      throw new AppError('Could not read the uploaded documents for validation', {
        statusCode: 502,
        code: 'DOCUMENT_READ_FAILED',
      });
    }

    try {
      return await this.validationClient.validate({
        rulesVersion: this.options.rulesVersion,
        projectId,
        projectVersion: 1,
        project: project.details,
        documents,
      });
    } catch (error) {
      if (error instanceof ValidationEngineError) {
        const isConfigFault = error.kind === 'unauthorized' || error.kind === 'invalid-response';
        logger[isConfigFault ? 'error' : 'warn']({ err: error }, 'Validation service call failed');
        throw new AppError('The validation service is unavailable', {
          statusCode: isConfigFault ? 502 : 503,
          code: 'VALIDATION_UNAVAILABLE',
        });
      }
      throw error;
    }
  }
}
