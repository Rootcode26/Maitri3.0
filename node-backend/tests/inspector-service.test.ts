import { describe, expect, it, vi } from 'vitest';

import type { ObjectStorage } from '../src/integrations/s3/storage.js';
import type { InspectorRepository } from '../src/modules/inspector/inspector.repository.js';
import { InspectorService } from '../src/modules/inspector/inspector.service.js';
import type { InspectorApplicationDetail } from '../src/modules/inspector/inspector.types.js';

const application = (
  reviewStatus: 'pending' | 'under_review' = 'pending',
): InspectorApplicationDetail => ({
  projectId: '11111111-1111-4111-8111-111111111111',
  enterpriseName: 'Steel Works',
  industry: 'steel',
  district: 'Pune',
  primaryActivity: 'Steel rolling',
  projectStatus: 'submitted',
  submittedAt: '2026-09-21T00:00:00.000Z',
  applicant: { id: 'applicant-1', name: 'Applicant', phoneNumber: '+919876543210' },
  details: {} as InspectorApplicationDetail['details'],
  attention: null,
  validation: null,
  approvals: [
    {
      id: '22222222-2222-4222-8222-222222222222',
      approvalKey: 'factory-registration',
      title: 'Factory registration',
      requirementStatus: 'required',
      reviewStatus,
      decisionNote: null,
      reviewStartedAt: null,
      decidedAt: null,
      processingDays: 15,
      documents: [{ key: 'plan', name: 'Factory plan', required: true }],
    },
  ],
  documents: [
    {
      id: '33333333-3333-4333-8333-333333333333',
      projectId: '11111111-1111-4111-8111-111111111111',
      approvalKey: 'factory-registration',
      documentKey: 'plan',
      version: 1,
      fileName: 'plan.pdf',
      mimeType: 'application/pdf',
      detectedMimeType: 'application/pdf',
      sizeBytes: 100,
      fileReadStatus: 'readable',
      extractionStatus: 'not_run',
      expiresOn: null,
      createdAt: '2026-09-21T00:00:00.000Z',
      updatedAt: '2026-09-21T00:00:00.000Z',
      review: { status: 'pending', comment: null, inspectorId: null, reviewedAt: null },
    },
  ],
  clarifications: [],
});

const makeService = (
  repository: Partial<InspectorRepository>,
  storage: ObjectStorage | null = null,
) => new InspectorService(repository as InspectorRepository, storage);

describe('InspectorService', () => {
  it('requires every inspector to have a department', async () => {
    const service = makeService({ listApplications: vi.fn() });
    await expect(service.listApplications(null, { page: 1, pageSize: 20 })).rejects.toMatchObject({
      statusCode: 403,
      code: 'INSPECTOR_DEPARTMENT_REQUIRED',
    });
  });

  it('passes the authenticated department into the queue query', async () => {
    const listApplications = vi.fn().mockResolvedValue({ items: [], total: 0 });
    const service = makeService({ listApplications });
    await service.listApplications('department-1', { page: 1, pageSize: 20, status: 'pending' });
    expect(listApplications).toHaveBeenCalledWith('department-1', {
      page: 1,
      pageSize: 20,
      status: 'pending',
    });
  });

  it('hides applications outside the inspector department as not found', async () => {
    const service = makeService({ findApplication: vi.fn().mockResolvedValue(null) });
    await expect(service.getApplication('department-1', 'project-1')).rejects.toMatchObject({
      statusCode: 404,
      code: 'APPLICATION_NOT_FOUND',
    });
  });

  it('starts a pending approval review', async () => {
    const findApplication = vi
      .fn()
      .mockResolvedValueOnce(application('pending'))
      .mockResolvedValueOnce(application('under_review'));
    const startReview = vi.fn().mockResolvedValue(true);
    const service = makeService({ findApplication, startReview });
    const result = await service.startReview(
      'inspector-1',
      'department-1',
      application().projectId,
      application().approvals[0]!.id,
    );
    expect(result.approvals[0]!.reviewStatus).toBe('under_review');
    expect(startReview).toHaveBeenCalledWith(
      application().projectId,
      application().approvals[0]!.id,
      'department-1',
      'inspector-1',
    );
  });

  it('rejects starting a review twice', async () => {
    const service = makeService({
      findApplication: vi.fn().mockResolvedValue(application('under_review')),
    });
    await expect(
      service.startReview(
        'inspector-1',
        'department-1',
        application().projectId,
        application().approvals[0]!.id,
      ),
    ).rejects.toMatchObject({ statusCode: 409, code: 'INVALID_REVIEW_TRANSITION' });
  });

  it('issues a signed URL only for a department-owned document', async () => {
    const signedGetUrl = vi.fn().mockResolvedValue('https://storage.example/signed');
    const service = makeService(
      {
        findDocumentForDepartment: vi.fn().mockResolvedValue({
          storage_key: 'projects/p1/plan.pdf',
          file_name: 'plan.pdf',
        }),
      },
      { signedGetUrl } as unknown as ObjectStorage,
    );
    await expect(service.getDownloadUrl('department-1', 'project-1', 'doc-1')).resolves.toBe(
      'https://storage.example/signed',
    );
    expect(signedGetUrl).toHaveBeenCalledWith('projects/p1/plan.pdf', 'plan.pdf');
  });

  it('requires review to start before a document decision', async () => {
    const service = makeService({
      findDocumentForDepartment: vi
        .fn()
        .mockResolvedValue({ approval_key: 'factory-registration' }),
      findApplication: vi.fn().mockResolvedValue(application('pending')),
    });
    await expect(
      service.reviewDocument('inspector-1', 'department-1', 'project-1', 'doc-1', {
        status: 'accepted',
      }),
    ).rejects.toMatchObject({ statusCode: 409, code: 'REVIEW_NOT_STARTED' });
  });

  it('requires all latest mandatory documents to be accepted before approval', async () => {
    const service = makeService({
      findApplication: vi.fn().mockResolvedValue(application('under_review')),
    });
    await expect(
      service.decideApproval(
        'inspector-1',
        'department-1',
        application().projectId,
        application().approvals[0]!.id,
        { decision: 'approved' },
      ),
    ).rejects.toMatchObject({ statusCode: 422, code: 'DOCUMENT_REVIEWS_INCOMPLETE' });
  });

  it('requires clarification threads to be resolved before approval', async () => {
    const pending = application('under_review');
    pending.documents[0]!.review.status = 'accepted';
    pending.clarifications = [
      {
        id: 'clarification-1',
        projectId: pending.projectId,
        approvalId: pending.approvals[0]!.id,
        documentId: null,
        inspectorId: 'inspector-1',
        inspectorName: 'Inspector',
        message: 'Please confirm the document details.',
        status: 'responded',
        dueAt: null,
        createdAt: '2026-09-22T00:00:00.000Z',
        updatedAt: '2026-09-22T00:00:00.000Z',
        responses: [],
      },
    ];
    const service = makeService({ findApplication: vi.fn().mockResolvedValue(pending) });
    await expect(
      service.decideApproval(
        'inspector-1',
        'department-1',
        pending.projectId,
        pending.approvals[0]!.id,
        { decision: 'approved' },
      ),
    ).rejects.toMatchObject({ statusCode: 422, code: 'CLARIFICATIONS_UNRESOLVED' });
  });

  it('records approval after all required documents are accepted', async () => {
    const ready = application('under_review');
    ready.documents[0]!.review.status = 'accepted';
    const decideApproval = vi.fn().mockResolvedValue({ ...ready, projectStatus: 'approved' });
    const service = makeService({
      findApplication: vi.fn().mockResolvedValue(ready),
      decideApproval,
    });
    const result = await service.decideApproval(
      'inspector-1',
      'department-1',
      ready.projectId,
      ready.approvals[0]!.id,
      { decision: 'approved' },
    );
    expect(result.projectStatus).toBe('approved');
    expect(decideApproval).toHaveBeenCalledWith(
      expect.objectContaining({ decision: 'approved', departmentId: 'department-1' }),
    );
  });

  it('creates a clarification only after review starts', async () => {
    const createClarification = vi.fn().mockResolvedValue(true);
    const findApplication = vi
      .fn()
      .mockResolvedValueOnce(application('under_review'))
      .mockResolvedValueOnce(application('under_review'));
    const service = makeService({ findApplication, createClarification });
    await service.createClarification(
      'inspector-1',
      'department-1',
      application().projectId,
      application().approvals[0]!.id,
      { message: 'Please provide the missing technical specification.' },
    );
    expect(createClarification).toHaveBeenCalledWith(
      expect.objectContaining({ departmentId: 'department-1', inspectorId: 'inspector-1' }),
    );
  });

  it('rejects a clarification for a document outside the selected approval', async () => {
    const service = makeService({
      findApplication: vi.fn().mockResolvedValue(application('under_review')),
    });
    await expect(
      service.createClarification(
        'inspector-1',
        'department-1',
        application().projectId,
        application().approvals[0]!.id,
        {
          message: 'Please provide the missing technical specification.',
          documentId: '99999999-9999-4999-8999-999999999999',
        },
      ),
    ).rejects.toMatchObject({ statusCode: 404, code: 'DOCUMENT_NOT_FOUND' });
  });

  it('resolves only a clarification visible to the inspector department', async () => {
    const resolveClarification = vi.fn().mockResolvedValue(true);
    const findApplication = vi
      .fn()
      .mockResolvedValueOnce(application('under_review'))
      .mockResolvedValueOnce(application('under_review'));
    const service = makeService({ findApplication, resolveClarification });
    await service.resolveClarification('department-1', application().projectId, 'clarification-1');
    expect(resolveClarification).toHaveBeenCalledWith({
      departmentId: 'department-1',
      projectId: application().projectId,
      clarificationId: 'clarification-1',
    });
  });
});
