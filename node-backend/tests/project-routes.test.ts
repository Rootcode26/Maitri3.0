import cookieParser from 'cookie-parser';
import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { AppError } from '../src/errors/app-error.js';
import { errorHandler } from '../src/middleware/error-handler.js';
import { issueAccessToken } from '../src/modules/auth/token.service.js';
import { DocumentController } from '../src/modules/documents/document.controller.js';
import type { DocumentService } from '../src/modules/documents/document.service.js';
import { ProjectController } from '../src/modules/projects/project.controller.js';
import { createProjectRouter } from '../src/modules/projects/project.routes.js';
import type { ProjectService } from '../src/modules/projects/project.service.js';

vi.mock('../src/modules/auth/access-token-store.js', () => ({
  isAccessTokenRevoked: vi.fn().mockResolvedValue(false),
  revokeAccessToken: vi.fn().mockResolvedValue(undefined),
}));

const validBody = {
  enterpriseName: 'Sahyadri Foods Pvt. Ltd.',
  organisationType: 'private-limited',
  industry: 'food',
  pan: 'aabcs1234f',
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
};

const projectRecord = {
  id: 'project-1',
  enterpriseName: 'Sahyadri Foods Pvt. Ltd.',
  approvals: [],
};

const createTestApp = () => {
  const service = {
    createProject: vi.fn().mockResolvedValue(projectRecord),
    listProjects: vi.fn().mockResolvedValue([{ id: 'project-1' }]),
    getProject: vi.fn().mockResolvedValue(projectRecord),
    setApprovalDepartment: vi
      .fn()
      .mockResolvedValue({ approvalKey: 'consent-to-operate', department: { key: 'mpcb' } }),
  };
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  const documentController = new DocumentController({} as unknown as DocumentService);
  app.use(
    '/api/v1/projects',
    createProjectRouter(
      new ProjectController(service as unknown as ProjectService),
      documentController,
    ),
  );
  app.use(errorHandler);
  return { app, service };
};

const applicantCookie = () => `access_token=${issueAccessToken('applicant-1', 'applicant', null)}`;
const inspectorCookie = () =>
  `access_token=${issueAccessToken('inspector-1', 'inspector', 'department-1')}`;

describe('project routes', () => {
  it('creates a project for an authenticated applicant', async () => {
    const { app, service } = createTestApp();
    const response = await request(app)
      .post('/api/v1/projects')
      .set('Cookie', applicantCookie())
      .send(validBody);

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ status: 'success', data: { project: projectRecord } });
    expect(service.createProject).toHaveBeenCalledTimes(1);
    const [applicantId, input] = service.createProject.mock.calls[0]!;
    expect(applicantId).toBe('applicant-1');
    expect(input).toMatchObject({ enterpriseName: 'Sahyadri Foods Pvt. Ltd.', pan: 'AABCS1234F' });
  });

  it('rejects invalid input with a validation error and does not persist', async () => {
    const { app, service } = createTestApp();
    const response = await request(app)
      .post('/api/v1/projects')
      .set('Cookie', applicantCookie())
      .send({ ...validBody, enterpriseName: '   ', pan: 'bad' });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('VALIDATION_ERROR');
    expect(service.createProject).not.toHaveBeenCalled();
  });

  it('rejects an unknown field in the body (strict schema) and does not persist', async () => {
    const { app, service } = createTestApp();
    const response = await request(app)
      .post('/api/v1/projects')
      .set('Cookie', applicantCookie())
      .send({ ...validBody, injected: 'payload' });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('VALIDATION_ERROR');
    expect(service.createProject).not.toHaveBeenCalled();
  });

  it('rejects a conditional-required gap (boiler without capacity) with field details', async () => {
    const { app, service } = createTestApp();
    const response = await request(app)
      .post('/api/v1/projects')
      .set('Cookie', applicantCookie())
      .send({ ...validBody, boiler: 'yes' });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('VALIDATION_ERROR');
    expect(response.body.details.fieldErrors).toHaveProperty('boilerCapacity');
    expect(service.createProject).not.toHaveBeenCalled();
  });

  it('rejects an empty body', async () => {
    const { app, service } = createTestApp();
    const response = await request(app)
      .post('/api/v1/projects')
      .set('Cookie', applicantCookie())
      .send({});

    expect(response.status).toBe(400);
    expect(service.createProject).not.toHaveBeenCalled();
  });

  it('rejects a PATCH without a departmentKey', async () => {
    const { app, service } = createTestApp();
    const response = await request(app)
      .patch('/api/v1/projects/project-1/approvals/a1')
      .set('Cookie', applicantCookie())
      .send({});

    expect(response.status).toBe(400);
    expect(service.setApprovalDepartment).not.toHaveBeenCalled();
  });

  it('requires authentication', async () => {
    const { app, service } = createTestApp();
    const response = await request(app).post('/api/v1/projects').send(validBody);

    expect(response.status).toBe(401);
    expect(service.createProject).not.toHaveBeenCalled();
  });

  it('forbids non-applicant roles', async () => {
    const { app, service } = createTestApp();
    const response = await request(app)
      .post('/api/v1/projects')
      .set('Cookie', inspectorCookie())
      .send(validBody);

    expect(response.status).toBe(403);
    expect(service.createProject).not.toHaveBeenCalled();
  });

  it('lists the applicant projects', async () => {
    const { app, service } = createTestApp();
    const response = await request(app).get('/api/v1/projects').set('Cookie', applicantCookie());

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ data: { projects: [{ id: 'project-1' }] } });
    expect(service.listProjects).toHaveBeenCalledWith('applicant-1');
  });

  it('returns a single owned project', async () => {
    const { app, service } = createTestApp();
    const response = await request(app)
      .get('/api/v1/projects/project-1')
      .set('Cookie', applicantCookie());

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ data: { project: projectRecord } });
    expect(service.getProject).toHaveBeenCalledWith('applicant-1', 'project-1');
  });

  it('returns 404 when the project is not owned or missing', async () => {
    const { app, service } = createTestApp();
    service.getProject.mockRejectedValueOnce(
      new AppError('Project not found', { statusCode: 404, code: 'PROJECT_NOT_FOUND' }),
    );
    const response = await request(app)
      .get('/api/v1/projects/other')
      .set('Cookie', applicantCookie());

    expect(response.status).toBe(404);
    expect(response.body.code).toBe('PROJECT_NOT_FOUND');
  });

  it('requires authentication for reads', async () => {
    const { app } = createTestApp();
    expect((await request(app).get('/api/v1/projects')).status).toBe(401);
  });

  it('re-targets an approval to a chosen department', async () => {
    const { app, service } = createTestApp();
    const response = await request(app)
      .patch('/api/v1/projects/project-1/approvals/a1')
      .set('Cookie', applicantCookie())
      .send({ departmentKey: 'mpcb' });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ data: { approval: { department: { key: 'mpcb' } } } });
    expect(service.setApprovalDepartment).toHaveBeenCalledWith(
      'applicant-1',
      'project-1',
      'a1',
      'mpcb',
    );
  });

  it('rejects an unknown department key', async () => {
    const { app, service } = createTestApp();
    const response = await request(app)
      .patch('/api/v1/projects/project-1/approvals/a1')
      .set('Cookie', applicantCookie())
      .send({ departmentKey: 'not-a-department' });

    expect(response.status).toBe(400);
    expect(service.setApprovalDepartment).not.toHaveBeenCalled();
  });
});
