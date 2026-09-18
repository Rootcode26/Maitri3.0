import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  ValidationClient,
  ValidationEngineError,
  createValidationClient,
} from '../src/modules/documents/document.validation-client.js';

const options = { baseUrl: 'http://python.internal', token: 'secret-token', timeoutMs: 1_000 };

const request = {
  rulesVersion: '2026.09',
  projectId: 'project-1',
  projectVersion: 1,
  project: { industry: 'food' },
  documents: [],
};

const response = {
  rulesVersion: '2026.09',
  projectId: 'project-1',
  evaluatedAt: '2026-09-19T00:00:00Z',
  projectVersion: 1,
  validationStatus: 'review_required',
  blockingIssues: [],
  warnings: [],
  reviewItems: [
    {
      code: 'APPROVAL_OFFICER_REVIEW',
      severity: 'review',
      field: null,
      approvalKey: 'food-licence',
      documentKey: null,
      documentId: null,
      message: 'Officer review needed.',
      suggestedAction: 'Officer to confirm.',
    },
  ],
  documentChecks: [],
};

afterEach(() => vi.unstubAllGlobals());

describe('ValidationClient', () => {
  it('posts the request to /validate with the internal token and maps the response', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => response } as Response);
    vi.stubGlobal('fetch', fetchMock);

    const result = await new ValidationClient(options).validate(request);

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe('http://python.internal/validate');
    expect((init as RequestInit).method).toBe('POST');
    expect(((init as RequestInit).headers as Record<string, string>)['X-Internal-Token']).toBe(
      'secret-token',
    );
    expect(result.validationStatus).toBe('review_required');
    expect(result.reviewItems).toHaveLength(1);
  });

  it('classifies a 401 as unauthorized', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401 } as Response));
    const error = await new ValidationClient(options).validate(request).catch((e) => e);
    expect(error).toBeInstanceOf(ValidationEngineError);
    expect(error.kind).toBe('unauthorized');
  });

  it('classifies a 422 contract rejection as invalid-response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 422 } as Response));
    const error = await new ValidationClient(options).validate(request).catch((e) => e);
    expect(error.kind).toBe('invalid-response');
  });

  it('classifies a network failure as unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')));
    const error = await new ValidationClient(options).validate(request).catch((e) => e);
    expect(error.kind).toBe('unreachable');
  });

  it('rejects an invalid response shape', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ nonsense: true }) } as Response),
    );
    const error = await new ValidationClient(options).validate(request).catch((e) => e);
    expect(error.kind).toBe('invalid-response');
  });

  it('returns null from the factory when the service is not configured', () => {
    expect(createValidationClient({ RULES_SERVICE_TIMEOUT_MS: 5_000 })).toBeNull();
  });
});
