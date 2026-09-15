import cookieParser from 'cookie-parser';
import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { errorHandler } from '../src/middleware/error-handler.js';
import { issueAccessToken } from '../src/modules/auth/token.service.js';

const isAccessTokenRevoked = vi.fn();

vi.mock('../src/modules/auth/access-token-store.js', () => ({
  isAccessTokenRevoked,
}));

const {
  requireAuthentication,
  requireRoles,
  requireSelfOrRoles,
  requireDepartmentAccess,
  routeParam,
} = await import('../src/modules/auth/auth.middleware.js');

const applicantId = '94a84df4-779f-4e3b-98c3-d5ea23ccc75c';
const anotherUserId = '1646d9be-e193-43bc-8555-4b70b648768a';
const mpcbDepartmentId = '5de5a920-0df4-45a2-b3d0-a516f2936ef7';
const fireDepartmentId = '92ef5128-b40c-4574-8ca7-e07b9db9e8fc';

const createTestApp = () => {
  const app = express();
  app.use(cookieParser());
  app.get('/protected', requireAuthentication, (request, response) => {
    response.json({ user: request.user });
  });
  app.get(
    '/applicants-only',
    requireAuthentication,
    requireRoles('applicant'),
    (_request, response) => response.sendStatus(204),
  );
  app.get(
    '/users/:userId',
    requireAuthentication,
    requireSelfOrRoles(routeParam('userId')),
    (_request, response) => response.sendStatus(204),
  );
  app.get(
    '/departments/:departmentId/applications',
    requireAuthentication,
    requireDepartmentAccess(routeParam('departmentId')),
    (_request, response) => response.sendStatus(204),
  );
  app.get(
    '/missing-owner',
    requireAuthentication,
    requireSelfOrRoles(() => undefined),
    (_request, response) => response.sendStatus(204),
  );
  app.get(
    '/missing-department',
    requireAuthentication,
    requireDepartmentAccess(() => undefined),
    (_request, response) => response.sendStatus(204),
  );
  app.use(errorHandler);
  return app;
};

describe('authentication middleware', () => {
  beforeEach(() => isAccessTokenRevoked.mockReset().mockResolvedValue(false));

  it('rejects requests without an access-token cookie', async () => {
    const response = await request(createTestApp()).get('/protected');
    expect(response.status).toBe(401);
    expect(response.body.code).toBe('AUTHENTICATION_REQUIRED');
  });

  it('attaches verified claims to request.user', async () => {
    const token = issueAccessToken(applicantId, 'inspector', mpcbDepartmentId);
    const response = await request(createTestApp())
      .get('/protected')
      .set('Cookie', `access_token=${token}`);

    expect(response.status).toBe(200);
    expect(response.body.user).toMatchObject({
      userId: applicantId,
      role: 'inspector',
      departmentId: mpcbDepartmentId,
      jti: expect.any(String),
      exp: expect.any(Number),
    });
  });

  it('rejects a Redis-revoked access-token JTI', async () => {
    isAccessTokenRevoked.mockResolvedValue(true);
    const token = issueAccessToken('94a84df4-779f-4e3b-98c3-d5ea23ccc75c', 'applicant');
    const response = await request(createTestApp())
      .get('/protected')
      .set('Cookie', `access_token=${token}`);

    expect(response.status).toBe(401);
    expect(response.body.code).toBe('JWT_REVOKED');
  });

  it('allows only explicitly configured roles', async () => {
    const applicant = issueAccessToken(applicantId, 'applicant');
    const officer = issueAccessToken(applicantId, 'inspector', mpcbDepartmentId);

    expect(
      (
        await request(createTestApp())
          .get('/applicants-only')
          .set('Cookie', `access_token=${applicant}`)
      ).status,
    ).toBe(204);
    const denied = await request(createTestApp())
      .get('/applicants-only')
      .set('Cookie', `access_token=${officer}`);
    expect(denied.status).toBe(403);
    expect(denied.body.code).toBe('FORBIDDEN');
  });

  it('rejects role guards used without authentication', async () => {
    const response = await request(createTestApp()).get('/applicants-only');
    expect(response.status).toBe(401);
    expect(response.body.code).toBe('AUTHENTICATION_REQUIRED');
  });

  it('allows applicants to access only their own user-scoped resource', async () => {
    const applicant = issueAccessToken(applicantId, 'applicant');
    expect(
      (
        await request(createTestApp())
          .get(`/users/${applicantId}`)
          .set('Cookie', `access_token=${applicant}`)
      ).status,
    ).toBe(204);

    const denied = await request(createTestApp())
      .get(`/users/${anotherUserId}`)
      .set('Cookie', `access_token=${applicant}`);
    expect(denied.status).toBe(403);
    expect(denied.body.code).toBe('FORBIDDEN');
  });

  it('allows an inspector to access only their own department', async () => {
    const officer = issueAccessToken(applicantId, 'inspector', mpcbDepartmentId);
    expect(
      (
        await request(createTestApp())
          .get(`/departments/${mpcbDepartmentId}/applications`)
          .set('Cookie', `access_token=${officer}`)
      ).status,
    ).toBe(204);

    const denied = await request(createTestApp())
      .get(`/departments/${fireDepartmentId}/applications`)
      .set('Cookie', `access_token=${officer}`);
    expect(denied.status).toBe(403);
    expect(denied.body.message).toContain('outside your department');
  });

  it('does not grant department access to applicants or unassigned inspectors', async () => {
    for (const token of [
      issueAccessToken(applicantId, 'applicant'),
      issueAccessToken(applicantId, 'inspector'),
    ]) {
      const response = await request(createTestApp())
        .get(`/departments/${mpcbDepartmentId}/applications`)
        .set('Cookie', `access_token=${token}`);
      expect(response.status).toBe(403);
      expect(response.body.code).toBe('FORBIDDEN');
    }
  });

  it('rejects requests when required resource scope metadata is missing', async () => {
    const applicant = issueAccessToken(applicantId, 'applicant');
    const officer = issueAccessToken(applicantId, 'inspector', mpcbDepartmentId);
    const missingOwner = await request(createTestApp())
      .get('/missing-owner')
      .set('Cookie', `access_token=${applicant}`);
    const missingDepartment = await request(createTestApp())
      .get('/missing-department')
      .set('Cookie', `access_token=${officer}`);
    expect(missingOwner.body.code).toBe('RESOURCE_OWNER_REQUIRED');
    expect(missingDepartment.body.code).toBe('RESOURCE_DEPARTMENT_REQUIRED');
  });

  it('rejects empty role policies during application setup', () => {
    expect(() => requireRoles()).toThrow(TypeError);
  });
});
