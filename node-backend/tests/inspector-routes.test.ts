import cookieParser from 'cookie-parser';
import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { errorHandler } from '../src/middleware/error-handler.js';
import { issueAccessToken } from '../src/modules/auth/token.service.js';
import { InspectorController } from '../src/modules/inspector/inspector.controller.js';
import { createInspectorRouter } from '../src/modules/inspector/inspector.routes.js';
import type { InspectorService } from '../src/modules/inspector/inspector.service.js';

vi.mock('../src/modules/auth/access-token-store.js', () => ({
  isAccessTokenRevoked: vi.fn().mockResolvedValue(false),
}));

const projectId = '11111111-1111-4111-8111-111111111111';
const approvalId = '22222222-2222-4222-8222-222222222222';
const documentId = '33333333-3333-4333-8333-333333333333';
const departmentId = '44444444-4444-4444-8444-444444444444';

const createTestApp = () => {
  const service = {
    listApplications: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    getApplication: vi.fn().mockResolvedValue({ projectId, approvals: [], documents: [] }),
    getDownloadUrl: vi.fn().mockResolvedValue('https://storage.example/signed'),
    startReview: vi.fn().mockResolvedValue({ projectId, approvals: [], documents: [] }),
    reviewDocument: vi.fn().mockResolvedValue({ id: documentId, review: { status: 'accepted' } }),
    decideApproval: vi.fn().mockResolvedValue({ projectId, approvals: [], documents: [] }),
    createClarification: vi.fn().mockResolvedValue({ projectId, clarifications: [] }),
    resolveClarification: vi.fn().mockResolvedValue({ projectId, clarifications: [] }),
  };
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use(
    '/api/v1/inspector',
    createInspectorRouter(new InspectorController(service as unknown as InspectorService)),
  );
  app.use(errorHandler);
  return { app, service };
};

const inspectorCookie = () =>
  `access_token=${issueAccessToken('55555555-5555-4555-8555-555555555555', 'inspector', departmentId)}`;
const applicantCookie = () =>
  `access_token=${issueAccessToken('66666666-6666-4666-8666-666666666666', 'applicant', null)}`;

describe('inspector routes', () => {
  it('rejects applicants from the inspector queue', async () => {
    const { app } = createTestApp();
    const response = await request(app)
      .get('/api/v1/inspector/applications')
      .set('Cookie', applicantCookie());
    expect(response.status).toBe(403);
  });

  it('lists applications using the department from the JWT', async () => {
    const { app, service } = createTestApp();
    const response = await request(app)
      .get('/api/v1/inspector/applications?status=pending&page=2&pageSize=10')
      .set('Cookie', inspectorCookie());
    expect(response.status).toBe(200);
    expect(service.listApplications).toHaveBeenCalledWith(
      departmentId,
      expect.objectContaining({ status: 'pending', page: 2, pageSize: 10 }),
    );
  });

  it('rejects invalid queue filters', async () => {
    const { app, service } = createTestApp();
    const response = await request(app)
      .get('/api/v1/inspector/applications?pageSize=1000')
      .set('Cookie', inspectorCookie());
    expect(response.status).toBe(400);
    expect(service.listApplications).not.toHaveBeenCalled();
  });

  it('starts a department approval review', async () => {
    const { app, service } = createTestApp();
    const response = await request(app)
      .post(`/api/v1/inspector/applications/${projectId}/approvals/${approvalId}/start-review`)
      .set('Cookie', inspectorCookie());
    expect(response.status).toBe(200);
    expect(service.startReview).toHaveBeenCalledWith(
      '55555555-5555-4555-8555-555555555555',
      departmentId,
      projectId,
      approvalId,
    );
  });

  it('validates document correction comments before calling the service', async () => {
    const { app, service } = createTestApp();
    const response = await request(app)
      .post(`/api/v1/inspector/applications/${projectId}/documents/${documentId}/review`)
      .set('Cookie', inspectorCookie())
      .send({ status: 'correction_required' });
    expect(response.status).toBe(400);
    expect(service.reviewDocument).not.toHaveBeenCalled();
  });

  it('records a valid document review', async () => {
    const { app, service } = createTestApp();
    const response = await request(app)
      .post(`/api/v1/inspector/applications/${projectId}/documents/${documentId}/review`)
      .set('Cookie', inspectorCookie())
      .send({ status: 'accepted' });
    expect(response.status).toBe(200);
    expect(service.reviewDocument).toHaveBeenCalledWith(
      '55555555-5555-4555-8555-555555555555',
      departmentId,
      projectId,
      documentId,
      { status: 'accepted' },
    );
  });

  it('requires a reason before rejecting an approval', async () => {
    const { app, service } = createTestApp();
    const response = await request(app)
      .post(`/api/v1/inspector/applications/${projectId}/approvals/${approvalId}/decision`)
      .set('Cookie', inspectorCookie())
      .send({ decision: 'rejected' });
    expect(response.status).toBe(400);
    expect(service.decideApproval).not.toHaveBeenCalled();
  });

  it('returns a signed download URL without exposing storage keys', async () => {
    const { app } = createTestApp();
    const response = await request(app)
      .get(`/api/v1/inspector/applications/${projectId}/documents/${documentId}/download`)
      .set('Cookie', inspectorCookie());
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: 'success',
      data: { url: 'https://storage.example/signed' },
    });
    expect(JSON.stringify(response.body)).not.toContain('storageKey');
  });

  it('creates a validated clarification request for the inspector department', async () => {
    const { app, service } = createTestApp();
    const response = await request(app)
      .post(`/api/v1/inspector/applications/${projectId}/approvals/${approvalId}/clarifications`)
      .set('Cookie', inspectorCookie())
      .send({ message: 'Please provide a clearer copy of the factory plan.' });
    expect(response.status).toBe(201);
    expect(service.createClarification).toHaveBeenCalledWith(
      '55555555-5555-4555-8555-555555555555',
      departmentId,
      projectId,
      approvalId,
      { message: 'Please provide a clearer copy of the factory plan.' },
    );
  });

  it('rejects a clarification message that is too short', async () => {
    const { app, service } = createTestApp();
    const response = await request(app)
      .post(`/api/v1/inspector/applications/${projectId}/approvals/${approvalId}/clarifications`)
      .set('Cookie', inspectorCookie())
      .send({ message: 'Why?' });
    expect(response.status).toBe(400);
    expect(service.createClarification).not.toHaveBeenCalled();
  });

  it('resolves a department clarification request', async () => {
    const { app, service } = createTestApp();
    const clarificationId = '77777777-7777-4777-8777-777777777777';
    const response = await request(app)
      .post(`/api/v1/inspector/applications/${projectId}/clarifications/${clarificationId}/resolve`)
      .set('Cookie', inspectorCookie());
    expect(response.status).toBe(200);
    expect(service.resolveClarification).toHaveBeenCalledWith(
      departmentId,
      projectId,
      clarificationId,
    );
  });
});
