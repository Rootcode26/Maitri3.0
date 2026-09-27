import { describe, expect, it, vi } from 'vitest';

import { logger } from '../src/config/logger.js';
import { AppError } from '../src/errors/app-error.js';
import type { ProjectRepository } from '../src/modules/projects/project.repository.js';
import {
  RulesEngineError,
  type RulesEngineClient,
} from '../src/modules/projects/project.rules-client.js';
import { createProjectSchema } from '../src/modules/projects/project.schemas.js';
import { ProjectService, type ProjectValidator } from '../src/modules/projects/project.service.js';
import type { ValidationResult } from '../src/modules/documents/document.validation-client.js';

const validationResult = (overrides: Partial<ValidationResult> = {}): ValidationResult => ({
  rulesVersion: '2026.09',
  projectId: 'p1',
  projectVersion: 1,
  validationStatus: 'complete',
  blockingIssues: [],
  warnings: [],
  reviewItems: [],
  documentChecks: [],
  ...overrides,
});

const input = createProjectSchema.parse({
  enterpriseName: 'Sahyadri Foods Pvt. Ltd.',
  organisationType: 'private-limited',
  industry: 'food',
  pan: 'AABCS1234F',
  district: 'Pune',
  pincode: '410501',
  plotArea: '500–2,000',
  landStatus: 'owned',
  primaryActivity: 'Food & beverage processing',
  projectStage: 'new',
  boiler: 'no',
  hazardousChemicals: 'no',
  electricity: '100–500',
  waterUse: '10–50',
  wastewater: 'On-site treatment plant',
  hazardousWaste: 'no',
  permanent: '20–49',
  fssaiCategory: 'State licence',
});

describe('ProjectService', () => {
  it('returns an applicant-scoped application detail workspace', async () => {
    const detail = { id: 'p1', applicantId: 'applicant-1', documents: [], timeline: [] };
    const findApplicationDetailByApplicant = vi.fn().mockResolvedValue(detail);
    const service = new ProjectService({
      findApplicationDetailByApplicant,
    } as unknown as ProjectRepository);
    await expect(service.getApplicationDetail('applicant-1', 'p1')).resolves.toBe(detail);
    expect(findApplicationDetailByApplicant).toHaveBeenCalledWith('applicant-1', 'p1');
  });

  it('hides an unowned application detail workspace', async () => {
    const service = new ProjectService({
      findApplicationDetailByApplicant: vi.fn().mockResolvedValue(null),
    } as unknown as ProjectRepository);
    await expect(service.getApplicationDetail('applicant-1', 'p1')).rejects.toMatchObject({
      statusCode: 404,
      code: 'PROJECT_NOT_FOUND',
    });
  });
  it('submits a complete draft project', async () => {
    const project = { id: 'p1', status: 'submitted' };
    const submitProject = vi.fn().mockResolvedValue({
      project,
      missingDocuments: [],
      conflict: false,
    });
    const service = new ProjectService({ submitProject } as unknown as ProjectRepository);

    await expect(service.submitProject('applicant-1', 'p1')).resolves.toBe(project);
    // No validator configured -> no attention or flags captured.
    expect(submitProject).toHaveBeenCalledWith('applicant-1', 'p1', null, null);
  });

  it('rejects submission when required documents are missing', async () => {
    const submitProject = vi.fn().mockResolvedValue({
      project: null,
      missingDocuments: ['Factory plan', 'Identity proof'],
      conflict: false,
    });
    const service = new ProjectService({ submitProject } as unknown as ProjectRepository);

    await expect(service.submitProject('applicant-1', 'p1')).rejects.toMatchObject({
      statusCode: 422,
      code: 'REQUIRED_DOCUMENTS_MISSING',
      details: { missingDocuments: ['Factory plan', 'Identity proof'] },
    });
  });

  it('rejects repeat submission of a non-draft project', async () => {
    const submitProject = vi.fn().mockResolvedValue({
      project: null,
      missingDocuments: [],
      conflict: true,
    });
    const service = new ProjectService({ submitProject } as unknown as ProjectRepository);
    await expect(service.submitProject('applicant-1', 'p1')).rejects.toMatchObject({
      statusCode: 409,
      code: 'PROJECT_NOT_DRAFT',
    });
  });

  it('does not expose whether an unowned project exists during submission', async () => {
    const submitProject = vi.fn().mockResolvedValue({
      project: null,
      missingDocuments: [],
      conflict: false,
    });
    const service = new ProjectService({ submitProject } as unknown as ProjectRepository);
    await expect(service.submitProject('applicant-1', 'p1')).rejects.toMatchObject({
      statusCode: 404,
      code: 'PROJECT_NOT_FOUND',
    });
  });

  it('blocks submission when validation reports blocking issues and never transitions the project', async () => {
    const submitProject = vi.fn();
    const validateProject = vi.fn().mockResolvedValue(
      validationResult({
        validationStatus: 'review_required',
        blockingIssues: [
          {
            code: 'REQUIRED_DOCUMENT_MISSING',
            severity: 'error',
            message: 'A required document is missing.',
            suggestedAction: 'Upload it and re-check.',
          },
        ],
      }),
    );
    const service = new ProjectService({ submitProject } as unknown as ProjectRepository, null, {
      validateProject,
    } as unknown as ProjectValidator);

    await expect(service.submitProject('applicant-1', 'p1')).rejects.toMatchObject({
      statusCode: 422,
      code: 'SUBMISSION_HAS_BLOCKING_ISSUES',
    });
    expect(validateProject).toHaveBeenCalledWith('applicant-1', 'p1');
    expect(submitProject).not.toHaveBeenCalled();
  });

  it('allows submission when validation reports only warnings and review items', async () => {
    const project = { id: 'p1', status: 'submitted' };
    const submitProject = vi
      .fn()
      .mockResolvedValue({ project, missingDocuments: [], conflict: false });
    const validateProject = vi.fn().mockResolvedValue(
      validationResult({
        validationStatus: 'review_required',
        warnings: [
          {
            code: 'DOCUMENT_VALUE_LOOKS_DIFFERENT',
            severity: 'warning',
            message: 'The document value looks different.',
            suggestedAction: 'Double-check it.',
          },
        ],
        reviewItems: [
          {
            code: 'DOCUMENT_CONTENT_REVIEW_NEEDED',
            severity: 'review',
            message: 'An officer should review this.',
            suggestedAction: 'Pending officer review.',
          },
        ],
        attentionAssessment: {
          score: 45,
          level: 'high_attention',
          factors: [
            { code: 'HAZARDOUS', label: 'Hazardous chemicals', points: 20, explanation: 'x' },
          ],
        },
      }),
    );
    const service = new ProjectService({ submitProject } as unknown as ProjectRepository, null, {
      validateProject,
    } as unknown as ProjectValidator);

    await expect(service.submitProject('applicant-1', 'p1')).resolves.toBe(project);
    expect(validateProject).toHaveBeenCalledWith('applicant-1', 'p1');
    // The attention estimate and the non-blocking validation flags are both
    // captured and persisted with the submission for the inspector.
    expect(submitProject).toHaveBeenCalledWith(
      'applicant-1',
      'p1',
      {
        score: 45,
        level: 'high_attention',
        factors: [
          { code: 'HAZARDOUS', label: 'Hazardous chemicals', points: 20, explanation: 'x' },
        ],
      },
      {
        warnings: [
          {
            code: 'DOCUMENT_VALUE_LOOKS_DIFFERENT',
            severity: 'warning',
            message: 'The document value looks different.',
            suggestedAction: 'Double-check it.',
          },
        ],
        reviewItems: [
          {
            code: 'DOCUMENT_CONTENT_REVIEW_NEEDED',
            severity: 'review',
            message: 'An officer should review this.',
            suggestedAction: 'Pending officer review.',
          },
        ],
        documentChecks: [],
      },
    );
  });

  it('fails submission closed when the configured validator is unavailable', async () => {
    const submitProject = vi.fn();
    const validateProject = vi.fn().mockRejectedValue(
      new AppError('The validation service is unavailable', {
        statusCode: 503,
        code: 'VALIDATION_UNAVAILABLE',
      }),
    );
    const service = new ProjectService({ submitProject } as unknown as ProjectRepository, null, {
      validateProject,
    } as unknown as ProjectValidator);

    await expect(service.submitProject('applicant-1', 'p1')).rejects.toMatchObject({
      statusCode: 503,
      code: 'VALIDATION_UNAVAILABLE',
    });
    expect(submitProject).not.toHaveBeenCalled();
  });

  it('derives approvals with the built-in rules when no engine is configured', async () => {
    const createProject = vi.fn().mockResolvedValue({ id: 'project-1' });
    const service = new ProjectService({ createProject } as unknown as ProjectRepository);

    const result = await service.createProject('applicant-1', input);

    expect(result).toEqual({ id: 'project-1' });
    expect(createProject).toHaveBeenCalledTimes(1);
    const [applicantId, projectId, passedInput, approvals] = createProject.mock.calls[0]!;
    expect(applicantId).toBe('applicant-1');
    expect(typeof projectId).toBe('string');
    expect(passedInput).toBe(input);
    expect(approvals.map((a: { title: string }) => a.title)).toContain('Food-related licence');
  });

  it('uses the rules engine result when the engine is configured', async () => {
    const createProject = vi.fn().mockResolvedValue({ id: 'project-1' });
    const engineApprovals = [
      {
        key: 'from-engine',
        title: 'Engine approval',
        departmentKey: 'fssai',
        status: 'required',
        documents: [],
        processingDays: 10,
      },
    ];
    const evaluate = vi.fn().mockResolvedValue(engineApprovals);
    const service = new ProjectService(
      { createProject } as unknown as ProjectRepository,
      { evaluate } as unknown as RulesEngineClient,
    );

    await service.createProject('applicant-1', input);

    const engineProjectId = evaluate.mock.calls[0]![1];
    const storedProjectId = createProject.mock.calls[0]![1];
    expect(typeof engineProjectId).toBe('string');
    expect(storedProjectId).toBe(engineProjectId);
    expect(evaluate).toHaveBeenCalledWith(input, engineProjectId);
    expect(createProject.mock.calls[0]![3]).toBe(engineApprovals);
  });

  it('falls back to built-in rules when the engine call fails', async () => {
    const createProject = vi.fn().mockResolvedValue({ id: 'project-1' });
    const evaluate = vi.fn().mockRejectedValue(new Error('engine down'));
    const service = new ProjectService(
      { createProject } as unknown as ProjectRepository,
      { evaluate } as unknown as RulesEngineClient,
    );

    await service.createProject('applicant-1', input);

    expect(evaluate).toHaveBeenCalledTimes(1);
    const approvals = createProject.mock.calls[0]![3] as Array<{ title: string }>;
    expect(approvals.map((a) => a.title)).toContain('Food-related licence');
  });

  it('fails loudly on a configuration fault instead of fabricating a checklist', async () => {
    const error = vi.spyOn(logger, 'error').mockImplementation(() => logger);
    const createProject = vi.fn().mockResolvedValue({ id: 'project-1' });
    const evaluate = vi.fn().mockRejectedValue(new RulesEngineError('unauthorized', 'bad token'));
    const service = new ProjectService(
      { createProject } as unknown as ProjectRepository,
      { evaluate } as unknown as RulesEngineClient,
    );

    await expect(service.createProject('applicant-1', input)).rejects.toMatchObject({
      statusCode: 502,
      code: 'RULES_ENGINE_MISCONFIGURED',
    });
    expect(error).toHaveBeenCalledTimes(1);
    expect(createProject).not.toHaveBeenCalled();
    error.mockRestore();
  });

  it('rejects the submission with the blocking issues when the engine blocks it', async () => {
    const createProject = vi.fn().mockResolvedValue({ id: 'project-1' });
    const blockingIssues = [{ code: 'SUBMISSION_BLOCKED', message: 'Missing mandatory approval.' }];
    const evaluate = vi
      .fn()
      .mockRejectedValue(new RulesEngineError('blocked', 'blocked', undefined, blockingIssues));
    const service = new ProjectService(
      { createProject } as unknown as ProjectRepository,
      { evaluate } as unknown as RulesEngineClient,
    );

    await expect(service.createProject('applicant-1', input)).rejects.toMatchObject({
      statusCode: 422,
      code: 'SUBMISSION_BLOCKED',
      details: { blockingIssues },
    });
    expect(createProject).not.toHaveBeenCalled();
  });

  it('returns an owned project', async () => {
    const findProjectById = vi.fn().mockResolvedValue({ id: 'p1', applicantId: 'applicant-1' });
    const service = new ProjectService({ findProjectById } as unknown as ProjectRepository);
    await expect(service.getProject('applicant-1', 'p1')).resolves.toMatchObject({ id: 'p1' });
  });

  it('rejects reading a project owned by someone else', async () => {
    const findProjectById = vi.fn().mockResolvedValue({ id: 'p1', applicantId: 'other' });
    const service = new ProjectService({ findProjectById } as unknown as ProjectRepository);
    await expect(service.getProject('applicant-1', 'p1')).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it('rejects reading a missing project', async () => {
    const findProjectById = vi.fn().mockResolvedValue(null);
    const service = new ProjectService({ findProjectById } as unknown as ProjectRepository);
    await expect(service.getProject('applicant-1', 'missing')).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it('re-targets an approval department for an owned project', async () => {
    const findProjectById = vi.fn().mockResolvedValue({ id: 'p1', applicantId: 'applicant-1' });
    const updateApprovalDepartment = vi
      .fn()
      .mockResolvedValue({ approvalKey: 'consent-to-operate', department: { key: 'mpcb' } });
    const service = new ProjectService({
      findProjectById,
      updateApprovalDepartment,
    } as unknown as ProjectRepository);

    const approval = await service.setApprovalDepartment('applicant-1', 'p1', 'a1', 'mpcb');

    expect(approval.department.key).toBe('mpcb');
    expect(updateApprovalDepartment).toHaveBeenCalledWith('p1', 'a1', 'mpcb');
  });

  it('does not update an approval on a project owned by someone else', async () => {
    const findProjectById = vi.fn().mockResolvedValue({ id: 'p1', applicantId: 'other' });
    const updateApprovalDepartment = vi.fn();
    const service = new ProjectService({
      findProjectById,
      updateApprovalDepartment,
    } as unknown as ProjectRepository);

    await expect(
      service.setApprovalDepartment('applicant-1', 'p1', 'a1', 'mpcb'),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(updateApprovalDepartment).not.toHaveBeenCalled();
  });

  it('lists clarifications only through the applicant-scoped repository query', async () => {
    const clarifications = [{ id: 'clarification-1', status: 'open' }];
    const findClarificationsByApplicant = vi.fn().mockResolvedValue(clarifications);
    const service = new ProjectService({
      findClarificationsByApplicant,
    } as unknown as ProjectRepository);
    await expect(service.listClarifications('applicant-1', 'project-1')).resolves.toBe(
      clarifications,
    );
    expect(findClarificationsByApplicant).toHaveBeenCalledWith('applicant-1', 'project-1');
  });

  it('does not reveal clarification data for an unowned project', async () => {
    const service = new ProjectService({
      findClarificationsByApplicant: vi.fn().mockResolvedValue(null),
    } as unknown as ProjectRepository);
    await expect(service.listClarifications('applicant-1', 'other-project')).rejects.toMatchObject({
      statusCode: 404,
      code: 'PROJECT_NOT_FOUND',
    });
  });

  it('records a response and returns the refreshed clarification thread', async () => {
    const respondToClarification = vi.fn().mockResolvedValue(true);
    const refreshed = [{ id: 'clarification-1', status: 'responded' }];
    const findClarificationsByApplicant = vi.fn().mockResolvedValue(refreshed);
    const service = new ProjectService({
      respondToClarification,
      findClarificationsByApplicant,
    } as unknown as ProjectRepository);
    await expect(
      service.respondToClarification('applicant-1', 'project-1', 'clarification-1', {
        message: 'The requested detail has been added.',
      }),
    ).resolves.toBe(refreshed);
    expect(respondToClarification).toHaveBeenCalledWith({
      applicantId: 'applicant-1',
      projectId: 'project-1',
      clarificationId: 'clarification-1',
      message: 'The requested detail has been added.',
    });
  });
});
