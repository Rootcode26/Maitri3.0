import { describe, expect, it, vi } from 'vitest';

import type { ObjectStorage } from '../src/integrations/s3/storage.js';
import type { CertificateRepository } from '../src/modules/certificates/certificate.repository.js';
import { CertificateService } from '../src/modules/certificates/certificate.service.js';
import type {
  Certificate,
  CertificateProject,
} from '../src/modules/certificates/certificate.types.js';

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';
const BASE_URL = 'https://portal.example';

const project = (status = 'approved'): CertificateProject => ({
  projectId: PROJECT_ID,
  applicantId: 'applicant-1',
  enterpriseName: 'Steel Works',
  industry: 'steel',
  district: 'Pune',
  applicantName: 'Applicant',
  status,
  approvals: [
    {
      approvalKey: 'factory-registration',
      title: 'Factory registration',
      reviewStatus: 'approved',
    },
  ],
});

const certificate = (overrides: Partial<Certificate> = {}): Certificate => ({
  id: 'cert-1',
  projectId: PROJECT_ID,
  certificateNumber: 'MH-CLR-2026-000001',
  verificationCode: 'a'.repeat(24),
  status: 'active',
  storageKey: `certificates/${PROJECT_ID}/MH-CLR-2026-000001.pdf`,
  issuedById: 'inspector-1',
  issuedAt: '2026-09-28T00:00:00.000Z',
  revokedAt: null,
  revokeReason: null,
  ...overrides,
});

const storageStub = (): ObjectStorage => ({
  put: vi.fn().mockResolvedValue(undefined),
  get: vi.fn(),
  delete: vi.fn(),
  signedGetUrl: vi.fn().mockResolvedValue('https://signed.example/cert.pdf'),
});

const makeService = (
  repository: Partial<CertificateRepository>,
  storage: ObjectStorage | null = storageStub(),
) => new CertificateService(repository as CertificateRepository, storage, BASE_URL);

describe('CertificateService', () => {
  it('issues a certificate for an approved project and stores the PDF', async () => {
    const storage = storageStub();
    const create = vi.fn().mockResolvedValue(certificate());
    const service = makeService(
      {
        findByProject: vi.fn().mockResolvedValue(null),
        getProject: vi.fn().mockResolvedValue(project('approved')),
        nextCertificateNumber: vi.fn().mockResolvedValue('MH-CLR-2026-000001'),
        create,
      },
      storage,
    );

    const result = await service.issueForProject(PROJECT_ID, 'inspector-1');

    expect(result?.certificateNumber).toBe('MH-CLR-2026-000001');
    expect(storage.put).toHaveBeenCalledOnce();
    const putCall = (storage.put as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(Buffer.isBuffer(putCall[1])).toBe(true);
    expect(putCall[2]).toBe('application/pdf');
  });

  it('is idempotent — returns the existing certificate without re-issuing', async () => {
    const create = vi.fn();
    const getProject = vi.fn();
    const service = makeService({
      findByProject: vi.fn().mockResolvedValue(certificate()),
      getProject,
      create,
    });

    const result = await service.issueForProject(PROJECT_ID, 'inspector-1');

    expect(result?.certificateNumber).toBe('MH-CLR-2026-000001');
    expect(create).not.toHaveBeenCalled();
    expect(getProject).not.toHaveBeenCalled();
  });

  it('refuses to issue for a project that is not approved', async () => {
    const create = vi.fn();
    const service = makeService({
      findByProject: vi.fn().mockResolvedValue(null),
      getProject: vi.fn().mockResolvedValue(project('under_review')),
      create,
    });

    const result = await service.issueForProject(PROJECT_ID, 'inspector-1');

    expect(result).toBeNull();
    expect(create).not.toHaveBeenCalled();
  });

  it('verify returns only non-sensitive fields and marks revoked as invalid', async () => {
    const service = makeService({
      findByVerificationCode: vi.fn().mockResolvedValue(certificate({ status: 'revoked' })),
      getProject: vi.fn().mockResolvedValue(project('approved')),
    });

    const result = await service.verify('a'.repeat(24));

    expect(result).toEqual({
      valid: false,
      certificateNumber: 'MH-CLR-2026-000001',
      status: 'revoked',
      enterpriseName: 'Steel Works',
      district: 'Pune',
      issuedAt: '2026-09-28T00:00:00.000Z',
    });
    expect(result).not.toHaveProperty('applicantName');
    expect(result).not.toHaveProperty('verificationCode');
  });

  it('verify throws 404 for an unknown code', async () => {
    const service = makeService({
      findByVerificationCode: vi.fn().mockResolvedValue(null),
    });

    await expect(service.verify('b'.repeat(24))).rejects.toMatchObject({
      statusCode: 404,
      code: 'CERTIFICATE_NOT_FOUND',
    });
  });

  it('revoke throws 404 when there is no active certificate', async () => {
    const service = makeService({ revoke: vi.fn().mockResolvedValue(null) });

    await expect(service.revoke(PROJECT_ID, 'Fraudulent submission')).rejects.toMatchObject({
      statusCode: 404,
      code: 'CERTIFICATE_NOT_FOUND',
    });
  });

  it('issueForProjectSafely never throws when issuance fails', async () => {
    const service = makeService({
      findByProject: vi.fn().mockRejectedValue(new Error('db down')),
    });

    await expect(service.issueForProjectSafely(PROJECT_ID, 'inspector-1')).resolves.toBeUndefined();
  });
});
