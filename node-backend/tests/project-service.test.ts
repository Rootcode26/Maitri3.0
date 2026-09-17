import { describe, expect, it, vi } from 'vitest';

import { logger } from '../src/config/logger.js';
import type { ProjectRepository } from '../src/modules/projects/project.repository.js';
import {
  RulesEngineError,
  type RulesEngineClient,
} from '../src/modules/projects/project.rules-client.js';
import { createProjectSchema } from '../src/modules/projects/project.schemas.js';
import { ProjectService } from '../src/modules/projects/project.service.js';

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

  it('logs a configuration fault at error level and still falls back', async () => {
    const error = vi.spyOn(logger, 'error').mockImplementation(() => logger);
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => logger);
    const createProject = vi.fn().mockResolvedValue({ id: 'project-1' });
    const evaluate = vi.fn().mockRejectedValue(new RulesEngineError('unauthorized', 'bad token'));
    const service = new ProjectService(
      { createProject } as unknown as ProjectRepository,
      { evaluate } as unknown as RulesEngineClient,
    );

    await service.createProject('applicant-1', input);

    expect(error).toHaveBeenCalledTimes(1);
    expect(warn).not.toHaveBeenCalled();
    const approvals = createProject.mock.calls[0]![3] as Array<{ title: string }>;
    expect(approvals.map((a) => a.title)).toContain('Food-related licence');
    error.mockRestore();
    warn.mockRestore();
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
});
