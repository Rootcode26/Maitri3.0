import { DatabaseError } from 'pg';
import { describe, expect, it, vi } from 'vitest';

import type * as ContentInspection from '../src/modules/documents/document.content-inspection.js';
import type { MalwareScanner } from '../src/integrations/clamav/scanner.js';
import type { ObjectStorage } from '../src/integrations/s3/storage.js';
import type { ValidationClient } from '../src/modules/documents/document.validation-client.js';
import type { DocumentRepository } from '../src/modules/documents/document.repository.js';
import { DocumentService, type UploadedFile } from '../src/modules/documents/document.service.js';
import type { ProjectRepository } from '../src/modules/projects/project.repository.js';

vi.mock('../src/modules/documents/document.content-inspection.js', async (importOriginal) => {
  const actual = (await importOriginal()) as typeof ContentInspection;
  return { ...actual, inspectFileContent: vi.fn() };
});

const { inspectFileContent } =
  await import('../src/modules/documents/document.content-inspection.js');
const inspectMock = vi.mocked(inspectFileContent);

const project = {
  id: 'project-1',
  applicantId: 'applicant-1',
  approvals: [
    {
      id: 'a1',
      approvalKey: 'food-licence',
      documents: [{ key: 'factory-plan', name: 'Factory plan', formats: ['PDF'], maxSizeMb: 5 }],
    },
  ],
};

const file = (overrides: Partial<UploadedFile> = {}): UploadedFile => ({
  buffer: Buffer.from('%PDF-1.7'),
  originalName: 'plan.pdf',
  mimeType: 'application/pdf',
  size: 1_000,
  ...overrides,
});

const makeService = (over: {
  project?: unknown;
  storage?: ObjectStorage | null;
  scanner?: MalwareScanner | null;
  validationClient?: ValidationClient | null;
  includeBytes?: boolean;
  repo?: Partial<DocumentRepository>;
}) => {
  const projectRepository = {
    findProjectById: vi.fn().mockResolvedValue(over.project ?? project),
  } as unknown as ProjectRepository;
  const documentRepository = {
    nextVersion: vi.fn().mockResolvedValue(1),
    create: vi.fn(async (input) => ({
      id: 'doc-1',
      ...input,
      detectedMimeType: input.detectedMimeType,
    })),
    findById: vi.fn(),
    deleteById: vi.fn().mockResolvedValue(true),
    ...over.repo,
  } as unknown as DocumentRepository;
  const storage =
    over.storage === undefined
      ? ({
          put: vi.fn().mockResolvedValue(undefined),
          delete: vi.fn().mockResolvedValue(undefined),
        } as unknown as ObjectStorage)
      : over.storage;
  const scanner =
    over.scanner === undefined
      ? ({ scan: vi.fn().mockResolvedValue({ clean: true }) } as unknown as MalwareScanner)
      : over.scanner;
  const validationClient =
    over.validationClient === undefined
      ? ({ validate: vi.fn() } as unknown as ValidationClient)
      : over.validationClient;
  const service = new DocumentService(
    projectRepository,
    documentRepository,
    storage,
    scanner,
    validationClient,
    {
      defaultMaxSizeMb: 10,
      rulesVersion: '2026.09',
      includeDocumentBytes: over.includeBytes ?? false,
    },
  );
  return { service, projectRepository, documentRepository, storage, scanner, validationClient };
};

describe('DocumentService.uploadDocument', () => {
  it('rejects when object storage is not configured', async () => {
    const { service } = makeService({ storage: null });
    await expect(
      service.uploadDocument(
        'applicant-1',
        'project-1',
        { approvalKey: 'food-licence', documentKey: 'factory-plan' },
        file(),
      ),
    ).rejects.toMatchObject({ statusCode: 503, code: 'UPLOADS_NOT_CONFIGURED' });
  });

  it('rejects a project the applicant does not own', async () => {
    inspectMock.mockResolvedValue({ detectedMimeType: 'application/pdf' });
    const { service } = makeService({ project: { ...project, applicantId: 'someone-else' } });
    await expect(
      service.uploadDocument(
        'applicant-1',
        'project-1',
        { approvalKey: 'food-licence', documentKey: 'factory-plan' },
        file(),
      ),
    ).rejects.toMatchObject({ statusCode: 404, code: 'PROJECT_NOT_FOUND' });
  });

  it('rejects an unknown approval and unknown document', async () => {
    inspectMock.mockResolvedValue({ detectedMimeType: 'application/pdf' });
    const { service } = makeService({});
    await expect(
      service.uploadDocument(
        'applicant-1',
        'project-1',
        { approvalKey: 'nope', documentKey: 'factory-plan' },
        file(),
      ),
    ).rejects.toMatchObject({ statusCode: 404, code: 'APPROVAL_NOT_FOUND' });
    await expect(
      service.uploadDocument(
        'applicant-1',
        'project-1',
        { approvalKey: 'food-licence', documentKey: 'nope' },
        file(),
      ),
    ).rejects.toMatchObject({ statusCode: 404, code: 'DOCUMENT_NOT_FOUND' });
  });

  it('enforces the decimal-MB size limit from the document spec', async () => {
    inspectMock.mockResolvedValue({ detectedMimeType: 'application/pdf' });
    const { service, storage } = makeService({});
    await expect(
      service.uploadDocument(
        'applicant-1',
        'project-1',
        { approvalKey: 'food-licence', documentKey: 'factory-plan' },
        file({ size: 5_000_000 }),
      ),
    ).resolves.toBeTruthy();
    await expect(
      service.uploadDocument(
        'applicant-1',
        'project-1',
        { approvalKey: 'food-licence', documentKey: 'factory-plan' },
        file({ size: 5_000_001 }),
      ),
    ).rejects.toMatchObject({ statusCode: 400, code: 'FILE_TOO_LARGE' });
    expect((storage as unknown as { put: ReturnType<typeof vi.fn> }).put).toHaveBeenCalledTimes(1);
  });

  it('rejects a file whose real content is not an allowed format', async () => {
    inspectMock.mockResolvedValue({ detectedMimeType: 'image/gif' });
    const { service, storage } = makeService({});
    await expect(
      service.uploadDocument(
        'applicant-1',
        'project-1',
        { approvalKey: 'food-licence', documentKey: 'factory-plan' },
        file(),
      ),
    ).rejects.toMatchObject({ statusCode: 400, code: 'UNSUPPORTED_FILE_TYPE' });
    expect((storage as unknown as { put: ReturnType<typeof vi.fn> }).put).not.toHaveBeenCalled();
  });

  it('stores the file and persists a record on success', async () => {
    inspectMock.mockResolvedValue({ detectedMimeType: 'application/pdf' });
    const { service, storage, documentRepository } = makeService({});
    const record = await service.uploadDocument(
      'applicant-1',
      'project-1',
      { approvalKey: 'food-licence', documentKey: 'factory-plan' },
      file(),
    );
    const put = (storage as unknown as { put: ReturnType<typeof vi.fn> }).put;
    expect(put).toHaveBeenCalledTimes(1);
    const [storageKey, , contentType] = put.mock.calls[0]!;
    expect(storageKey).toMatch(/^projects\/project-1\/food-licence\/factory-plan\//);
    expect(contentType).toBe('application/pdf');
    expect(documentRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: 'project-1',
        approvalKey: 'food-licence',
        documentKey: 'factory-plan',
        detectedMimeType: 'application/pdf',
        fileReadStatus: 'readable',
        uploadedBy: 'applicant-1',
      }),
    );
    expect(record.id).toBe('doc-1');
  });

  it('rejects a file flagged by the malware scanner and never stores it', async () => {
    inspectMock.mockResolvedValue({ detectedMimeType: 'application/pdf' });
    const scanner = {
      scan: vi.fn().mockResolvedValue({ clean: false, signature: 'Eicar-Test-Signature' }),
    } as unknown as MalwareScanner;
    const { service, storage } = makeService({ scanner });
    await expect(
      service.uploadDocument(
        'applicant-1',
        'project-1',
        { approvalKey: 'food-licence', documentKey: 'factory-plan' },
        file(),
      ),
    ).rejects.toMatchObject({ statusCode: 400, code: 'MALWARE_DETECTED' });
    expect((storage as unknown as { put: ReturnType<typeof vi.fn> }).put).not.toHaveBeenCalled();
  });

  it('fails closed (503) and does not store when the scanner is unreachable', async () => {
    inspectMock.mockResolvedValue({ detectedMimeType: 'application/pdf' });
    const scanner = {
      scan: vi.fn().mockRejectedValue(new Error('clamd down')),
    } as unknown as MalwareScanner;
    const { service, storage } = makeService({ scanner });
    await expect(
      service.uploadDocument(
        'applicant-1',
        'project-1',
        { approvalKey: 'food-licence', documentKey: 'factory-plan' },
        file(),
      ),
    ).rejects.toMatchObject({ statusCode: 503, code: 'SCAN_UNAVAILABLE' });
    expect((storage as unknown as { put: ReturnType<typeof vi.fn> }).put).not.toHaveBeenCalled();
  });

  it('stores without scanning when no scanner is configured', async () => {
    inspectMock.mockResolvedValue({ detectedMimeType: 'application/pdf' });
    const { service, storage } = makeService({ scanner: null });
    await service.uploadDocument(
      'applicant-1',
      'project-1',
      { approvalKey: 'food-licence', documentKey: 'factory-plan' },
      file(),
    );
    expect((storage as unknown as { put: ReturnType<typeof vi.fn> }).put).toHaveBeenCalledTimes(1);
  });

  it('marks an encrypted PDF as password protected', async () => {
    inspectMock.mockResolvedValue({ detectedMimeType: 'application/pdf' });
    const { service, documentRepository } = makeService({});
    await service.uploadDocument(
      'applicant-1',
      'project-1',
      { approvalKey: 'food-licence', documentKey: 'factory-plan' },
      file({ buffer: Buffer.from('%PDF-1.7 ... /Encrypt 5 0 R ... trailer') }),
    );
    expect(documentRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ fileReadStatus: 'password_protected' }),
    );
  });

  it('maps a concurrent version clash to a 409 and cleans up the stored object', async () => {
    inspectMock.mockResolvedValue({ detectedMimeType: 'application/pdf' });
    const del = vi.fn().mockResolvedValue(undefined);
    const storage = {
      put: vi.fn().mockResolvedValue(undefined),
      delete: del,
    } as unknown as ObjectStorage;
    const conflict = Object.assign(new DatabaseError('dup', 0, 'error'), { code: '23505' });
    const { service } = makeService({
      storage,
      repo: {
        nextVersion: vi.fn().mockResolvedValue(1),
        create: vi.fn().mockRejectedValue(conflict),
      },
    });
    await expect(
      service.uploadDocument(
        'applicant-1',
        'project-1',
        { approvalKey: 'food-licence', documentKey: 'factory-plan' },
        file(),
      ),
    ).rejects.toMatchObject({ statusCode: 409, code: 'DOCUMENT_VERSION_CONFLICT' });
    expect(del).toHaveBeenCalledTimes(1);
  });

  it('cleans up the stored object if persistence fails', async () => {
    inspectMock.mockResolvedValue({ detectedMimeType: 'application/pdf' });
    const del = vi.fn().mockResolvedValue(undefined);
    const storage = {
      put: vi.fn().mockResolvedValue(undefined),
      delete: del,
    } as unknown as ObjectStorage;
    const { service } = makeService({
      storage,
      repo: {
        nextVersion: vi.fn().mockResolvedValue(1),
        create: vi.fn().mockRejectedValue(new Error('db down')),
      },
    });
    await expect(
      service.uploadDocument(
        'applicant-1',
        'project-1',
        { approvalKey: 'food-licence', documentKey: 'factory-plan' },
        file(),
      ),
    ).rejects.toThrow(/db down/);
    expect(del).toHaveBeenCalledTimes(1);
  });
});

describe('DocumentService list/delete', () => {
  it('lists documents for an owned project', async () => {
    const { service, documentRepository } = makeService({});
    (documentRepository.findByProject as unknown) = vi.fn().mockResolvedValue([{ id: 'doc-1' }]);
    const docs = await service.listDocuments('applicant-1', 'project-1');
    expect(docs).toHaveLength(1);
  });

  it('404s deleting a document that does not exist', async () => {
    const { service } = makeService({ repo: { findById: vi.fn().mockResolvedValue(null) } });
    await expect(
      service.deleteDocument('applicant-1', 'project-1', 'missing'),
    ).rejects.toMatchObject({
      statusCode: 404,
      code: 'DOCUMENT_NOT_FOUND',
    });
  });

  it('deletes the record and the stored object', async () => {
    const del = vi.fn().mockResolvedValue(undefined);
    const storage = { put: vi.fn(), delete: del } as unknown as ObjectStorage;
    const { service, documentRepository } = makeService({
      storage,
      repo: {
        findById: vi.fn().mockResolvedValue({ id: 'doc-1', storageKey: 'projects/p/x' }),
        deleteById: vi.fn().mockResolvedValue(true),
      },
    });
    await service.deleteDocument('applicant-1', 'project-1', 'doc-1');
    expect(documentRepository.deleteById).toHaveBeenCalledWith('project-1', 'doc-1');
    expect(del).toHaveBeenCalledWith('projects/p/x');
  });
});

describe('DocumentService.getDownloadUrl', () => {
  it('returns a signed URL for an owned document', async () => {
    const storage = {
      put: vi.fn(),
      delete: vi.fn(),
      signedGetUrl: vi.fn().mockResolvedValue('https://signed.example/plan.pdf'),
    } as unknown as ObjectStorage;
    const { service } = makeService({
      storage,
      repo: { findById: vi.fn().mockResolvedValue({ id: 'doc-1', storageKey: 'projects/p/x' }) },
    });
    await expect(service.getDownloadUrl('applicant-1', 'project-1', 'doc-1')).resolves.toBe(
      'https://signed.example/plan.pdf',
    );
  });

  it('404s for a document that does not exist', async () => {
    const { service } = makeService({ repo: { findById: vi.fn().mockResolvedValue(null) } });
    await expect(
      service.getDownloadUrl('applicant-1', 'project-1', 'missing'),
    ).rejects.toMatchObject({ statusCode: 404, code: 'DOCUMENT_NOT_FOUND' });
  });
});

describe('DocumentService.validateProject', () => {
  it('503s when the validation service is not configured', async () => {
    const { service } = makeService({ validationClient: null });
    await expect(service.validateProject('applicant-1', 'project-1')).rejects.toMatchObject({
      statusCode: 503,
      code: 'VALIDATION_NOT_CONFIGURED',
    });
  });

  it('builds the request from stored documents and returns the verdict', async () => {
    const validate = vi.fn().mockResolvedValue({ validationStatus: 'complete' });
    const documents = [
      {
        id: 'doc-1',
        approvalKey: 'food-licence',
        documentKey: 'factory-plan',
        version: 1,
        fileName: 'plan.pdf',
        mimeType: 'application/pdf',
        detectedMimeType: 'application/pdf',
        sizeBytes: 1000,
        storageKey: 'projects/p/x',
        fileReadStatus: 'readable',
        extractionStatus: 'not_run',
        expiresOn: null,
      },
    ];
    const { service } = makeService({
      validationClient: { validate } as unknown as ValidationClient,
      repo: { findByProject: vi.fn().mockResolvedValue(documents) },
    });

    const result = await service.validateProject('applicant-1', 'project-1');
    expect(result).toMatchObject({ validationStatus: 'complete' });
    const sent = validate.mock.calls[0]![0];
    expect(sent).toMatchObject({
      rulesVersion: '2026.09',
      projectId: 'project-1',
      projectVersion: 1,
    });
    expect(sent.documents[0]).toMatchObject({
      documentId: 'doc-1',
      approvalKey: 'food-licence',
      documentKey: 'factory-plan',
      extractionStatus: 'not_run',
      extractedData: null,
      storageKey: null,
    });
  });

  it('sends only the latest version of each document to the validator', async () => {
    const validate = vi.fn().mockResolvedValue({ validationStatus: 'complete' });
    const documents = [
      {
        id: 'd1',
        approvalKey: 'food-licence',
        documentKey: 'factory-plan',
        version: 1,
        fileName: 'v1.pdf',
        mimeType: 'application/pdf',
        detectedMimeType: 'application/pdf',
        sizeBytes: 10,
        storageKey: 'k1',
        fileReadStatus: 'readable',
        extractionStatus: 'not_run',
        expiresOn: null,
      },
      {
        id: 'd2',
        approvalKey: 'food-licence',
        documentKey: 'factory-plan',
        version: 2,
        fileName: 'v2.pdf',
        mimeType: 'application/pdf',
        detectedMimeType: 'application/pdf',
        sizeBytes: 10,
        storageKey: 'k2',
        fileReadStatus: 'readable',
        extractionStatus: 'not_run',
        expiresOn: null,
      },
    ];
    const { service } = makeService({
      validationClient: { validate } as unknown as ValidationClient,
      repo: { findByProject: vi.fn().mockResolvedValue(documents) },
    });
    await service.validateProject('applicant-1', 'project-1');
    const sent = validate.mock.calls[0]![0];
    expect(sent.documents).toHaveLength(1);
    expect(sent.documents[0]).toMatchObject({ documentId: 'd2', version: 2 });
  });

  it('omits document bytes by default', async () => {
    const validate = vi.fn().mockResolvedValue({ validationStatus: 'complete' });
    const get = vi.fn();
    const storage = {
      put: vi.fn(),
      delete: vi.fn(),
      get,
      signedGetUrl: vi.fn(),
    } as unknown as ObjectStorage;
    const documents = [
      {
        id: 'd1',
        approvalKey: 'food-licence',
        documentKey: 'factory-plan',
        version: 1,
        fileName: 'p.pdf',
        mimeType: 'application/pdf',
        detectedMimeType: 'application/pdf',
        sizeBytes: 10,
        storageKey: 'k1',
        fileReadStatus: 'readable',
        extractionStatus: 'not_run',
        expiresOn: null,
      },
    ];
    const { service } = makeService({
      storage,
      validationClient: { validate } as unknown as ValidationClient,
      repo: { findByProject: vi.fn().mockResolvedValue(documents) },
    });
    await service.validateProject('applicant-1', 'project-1');
    expect(get).not.toHaveBeenCalled();
    expect(validate.mock.calls[0]![0].documents[0]).not.toHaveProperty('content');
  });

  it('attaches base64 document bytes when the flag is enabled', async () => {
    const validate = vi.fn().mockResolvedValue({ validationStatus: 'complete' });
    const get = vi.fn().mockResolvedValue(Buffer.from('PDFBYTES'));
    const storage = {
      put: vi.fn(),
      delete: vi.fn(),
      get,
      signedGetUrl: vi.fn(),
    } as unknown as ObjectStorage;
    const documents = [
      {
        id: 'd1',
        approvalKey: 'food-licence',
        documentKey: 'factory-plan',
        version: 1,
        fileName: 'p.pdf',
        mimeType: 'application/pdf',
        detectedMimeType: 'application/pdf',
        sizeBytes: 10,
        storageKey: 'k1',
        fileReadStatus: 'readable',
        extractionStatus: 'not_run',
        expiresOn: null,
      },
    ];
    const { service } = makeService({
      storage,
      includeBytes: true,
      validationClient: { validate } as unknown as ValidationClient,
      repo: { findByProject: vi.fn().mockResolvedValue(documents) },
    });
    await service.validateProject('applicant-1', 'project-1');
    expect(get).toHaveBeenCalledWith('k1');
    expect(validate.mock.calls[0]![0].documents[0].content).toBe(
      Buffer.from('PDFBYTES').toString('base64'),
    );
  });

  it('fails cleanly (502) if a document cannot be read from storage', async () => {
    const validate = vi.fn();
    const get = vi.fn().mockRejectedValue(new Error('S3 down'));
    const storage = {
      put: vi.fn(),
      delete: vi.fn(),
      get,
      signedGetUrl: vi.fn(),
    } as unknown as ObjectStorage;
    const documents = [
      {
        id: 'd1',
        approvalKey: 'food-licence',
        documentKey: 'factory-plan',
        version: 1,
        fileName: 'p.pdf',
        mimeType: 'application/pdf',
        detectedMimeType: 'application/pdf',
        sizeBytes: 10,
        storageKey: 'k1',
        fileReadStatus: 'readable',
        extractionStatus: 'not_run',
        expiresOn: null,
      },
    ];
    const { service } = makeService({
      storage,
      includeBytes: true,
      validationClient: { validate } as unknown as ValidationClient,
      repo: { findByProject: vi.fn().mockResolvedValue(documents) },
    });
    await expect(service.validateProject('applicant-1', 'project-1')).rejects.toMatchObject({
      statusCode: 502,
      code: 'DOCUMENT_READ_FAILED',
    });
    expect(validate).not.toHaveBeenCalled();
  });

  it('maps a configuration fault to 502 and an outage to 503', async () => {
    const { ValidationEngineError } =
      await import('../src/modules/documents/document.validation-client.js');
    const configFault = {
      validate: vi.fn().mockRejectedValue(new ValidationEngineError('unauthorized', 'bad token')),
    } as unknown as ValidationClient;
    const outage = {
      validate: vi.fn().mockRejectedValue(new ValidationEngineError('unreachable', 'down')),
    } as unknown as ValidationClient;

    await expect(
      makeService({
        validationClient: configFault,
        repo: { findByProject: vi.fn().mockResolvedValue([]) },
      }).service.validateProject('applicant-1', 'project-1'),
    ).rejects.toMatchObject({ statusCode: 502, code: 'VALIDATION_UNAVAILABLE' });
    await expect(
      makeService({
        validationClient: outage,
        repo: { findByProject: vi.fn().mockResolvedValue([]) },
      }).service.validateProject('applicant-1', 'project-1'),
    ).rejects.toMatchObject({ statusCode: 503, code: 'VALIDATION_UNAVAILABLE' });
  });
});
