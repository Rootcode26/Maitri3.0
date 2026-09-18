import cookieParser from 'cookie-parser';
import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { errorHandler } from '../src/middleware/error-handler.js';
import { DocumentController } from '../src/modules/documents/document.controller.js';
import { createDocumentRouter } from '../src/modules/documents/document.routes.js';
import type { DocumentService } from '../src/modules/documents/document.service.js';

vi.mock('../src/modules/auth/access-token-store.js', () => ({
  isAccessTokenRevoked: vi.fn().mockResolvedValue(false),
  revokeAccessToken: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../src/cache/redis.js', () => ({
  redisClient: {
    multi: () => ({ incr: () => ({ expire: () => ({ exec: async () => [[null, 1]] }) }) }),
  },
}));

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';
const DOCUMENT_ID = '22222222-2222-4222-8222-222222222222';

const record = {
  id: DOCUMENT_ID,
  projectId: PROJECT_ID,
  approvalKey: 'food-licence',
  documentKey: 'factory-plan',
  version: 1,
  fileName: 'plan.pdf',
  mimeType: 'application/pdf',
  detectedMimeType: 'application/pdf',
  sizeBytes: 1000,
  storageKey: 'projects/project-1/food-licence/factory-plan/uuid-plan.pdf',
  fileReadStatus: 'readable' as const,
  extractionStatus: 'not_run' as const,
  expiresOn: null,
  createdAt: '2026-09-19T00:00:00.000Z',
  updatedAt: '2026-09-19T00:00:00.000Z',
};

const makeApp = () => {
  const service = {
    uploadDocument: vi.fn().mockResolvedValue(record),
    listDocuments: vi.fn().mockResolvedValue([record]),
    deleteDocument: vi.fn().mockResolvedValue(undefined),
    getDownloadUrl: vi.fn().mockResolvedValue('https://signed.example/plan.pdf'),
  };
  const app = express();
  app.use(cookieParser());
  app.use((req, _res, next) => {
    (req as unknown as { user: unknown }).user = { userId: 'applicant-1', role: 'applicant' };
    next();
  });
  app.use(
    '/api/v1/projects/:id/documents',
    createDocumentRouter(new DocumentController(service as unknown as DocumentService)),
  );
  app.use(errorHandler);
  return { app, service };
};

describe('document routes', () => {
  it('uploads a multipart file and never leaks the storage key', async () => {
    const { app, service } = makeApp();
    const response = await request(app)
      .post(`/api/v1/projects/${PROJECT_ID}/documents`)
      .field('approvalKey', 'food-licence')
      .field('documentKey', 'factory-plan')
      .attach('file', Buffer.from('%PDF-1.7 fake'), 'plan.pdf');

    expect(response.status).toBe(201);
    expect(service.uploadDocument).toHaveBeenCalledTimes(1);
    const [applicantId, projectId, input, file] = service.uploadDocument.mock.calls[0]!;
    expect(applicantId).toBe('applicant-1');
    expect(projectId).toBe(PROJECT_ID);
    expect(input).toEqual({ approvalKey: 'food-licence', documentKey: 'factory-plan' });
    expect(file.originalName).toBe('plan.pdf');
    expect(Buffer.isBuffer(file.buffer)).toBe(true);
    expect(response.body.data.document).not.toHaveProperty('storageKey');
    expect(response.body.data.document.id).toBe(DOCUMENT_ID);
  });

  it('rejects a request with no file', async () => {
    const { app } = makeApp();
    const response = await request(app)
      .post(`/api/v1/projects/${PROJECT_ID}/documents`)
      .field('approvalKey', 'food-licence')
      .field('documentKey', 'factory-plan');
    expect(response.status).toBe(400);
    expect(response.body.code).toBe('FILE_REQUIRED');
  });

  it('rejects invalid metadata fields', async () => {
    const { app } = makeApp();
    const response = await request(app)
      .post(`/api/v1/projects/${PROJECT_ID}/documents`)
      .field('approvalKey', '')
      .field('documentKey', 'factory-plan')
      .attach('file', Buffer.from('%PDF-1.7 fake'), 'plan.pdf');
    expect(response.status).toBe(400);
    expect(response.body.code).toBe('VALIDATION_ERROR');
  });

  it('lists documents without storage keys', async () => {
    const { app } = makeApp();
    const response = await request(app).get(`/api/v1/projects/${PROJECT_ID}/documents`);
    expect(response.status).toBe(200);
    expect(response.body.data.documents[0]).not.toHaveProperty('storageKey');
  });

  it('deletes a document', async () => {
    const { app, service } = makeApp();
    const response = await request(app).delete(
      `/api/v1/projects/${PROJECT_ID}/documents/${DOCUMENT_ID}`,
    );
    expect(response.status).toBe(204);
    expect(service.deleteDocument).toHaveBeenCalledWith('applicant-1', PROJECT_ID, DOCUMENT_ID);
  });

  it('returns a signed download URL', async () => {
    const { app, service } = makeApp();
    const response = await request(app).get(
      `/api/v1/projects/${PROJECT_ID}/documents/${DOCUMENT_ID}/download`,
    );
    expect(response.status).toBe(200);
    expect(response.body.data.url).toBe('https://signed.example/plan.pdf');
    expect(service.getDownloadUrl).toHaveBeenCalledWith('applicant-1', PROJECT_ID, DOCUMENT_ID);
  });

  it('rejects a non-UUID project id with a 400 instead of a 500', async () => {
    const { app } = makeApp();
    const response = await request(app).get('/api/v1/projects/not-a-uuid/documents');
    expect(response.status).toBe(400);
    expect(response.body.code).toBe('VALIDATION_ERROR');
  });
});
