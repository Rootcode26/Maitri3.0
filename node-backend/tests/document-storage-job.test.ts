import { describe, expect, it, vi } from 'vitest';

import type { ObjectStorage } from '../src/integrations/s3/storage.js';
import type { DocumentRepository } from '../src/modules/documents/document.repository.js';
import { DocumentService } from '../src/modules/documents/document.service.js';
import type { ProjectRepository } from '../src/modules/projects/project.repository.js';

const makeService = (
  storage: ObjectStorage | null,
  documentRepository: Partial<DocumentRepository>,
) =>
  new DocumentService(
    {} as ProjectRepository,
    documentRepository as DocumentRepository,
    storage,
    null,
    null,
    { defaultMaxSizeMb: 10, rulesVersion: '2026.09', includeDocumentBytes: false },
  );

const storageStub = (): ObjectStorage => ({
  put: vi.fn().mockResolvedValue(undefined),
  get: vi.fn(),
  delete: vi.fn(),
  signedGetUrl: vi.fn(),
});

describe('DocumentService background storage', () => {
  it('stores the staged bytes and marks the document stored', async () => {
    const storage = storageStub();
    const markStorageStatus = vi.fn().mockResolvedValue(undefined);
    const service = makeService(storage, { markStorageStatus });

    await service.processStorageJob({
      documentId: 'doc-1',
      storageKey: 'projects/p/x/file.pdf',
      contentType: 'application/pdf',
      bytesBase64: Buffer.from('hello').toString('base64'),
    });

    expect(storage.put).toHaveBeenCalledOnce();
    const [key, body, contentType] = (storage.put as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(key).toBe('projects/p/x/file.pdf');
    expect(Buffer.isBuffer(body)).toBe(true);
    expect((body as Buffer).toString()).toBe('hello');
    expect(contentType).toBe('application/pdf');
    expect(markStorageStatus).toHaveBeenCalledWith('doc-1', 'stored');
  });

  it('throws if storage is not configured so the job retries', async () => {
    const service = makeService(null, { markStorageStatus: vi.fn() });
    await expect(
      service.processStorageJob({
        documentId: 'doc-1',
        storageKey: 'k',
        contentType: 'application/pdf',
        bytesBase64: '',
      }),
    ).rejects.toThrow();
  });

  it('marks a document failed', async () => {
    const markStorageStatus = vi.fn().mockResolvedValue(undefined);
    const service = makeService(storageStub(), { markStorageStatus });
    await service.markStorageFailed('doc-9');
    expect(markStorageStatus).toHaveBeenCalledWith('doc-9', 'failed');
  });
});
