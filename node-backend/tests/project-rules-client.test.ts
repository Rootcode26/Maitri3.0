import { afterEach, describe, expect, it, vi } from 'vitest';

import { logger } from '../src/config/logger.js';
import { createProjectSchema } from '../src/modules/projects/project.schemas.js';
import {
  RulesEngineClient,
  RulesEngineError,
  createRulesEngineClient,
} from '../src/modules/projects/project.rules-client.js';

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

const options = {
  baseUrl: 'http://python.internal',
  token: 'secret-token',
  rulesVersion: '2026.09',
  timeoutMs: 1_000,
};

const engineResponse = {
  approvals: [
    {
      key: 'food-licence',
      title: 'Food-related licence',
      status: 'required',
      reason: 'Food & beverage processing falls under the FSSAI Act.',
      ruleId: 'FSSAI-STATE-001',
      departmentKey: 'fssai',
      processingDays: 30,
      documents: [
        {
          key: 'factory-plan',
          name: 'Factory plan',
          description: 'A complete plan of the premises.',
          formats: ['PDF'],
          maxSizeMb: 5,
          filesRequired: 1,
          required: true,
          mustInclude: ['Plot boundary'],
          quality: ['One legible PDF'],
        },
      ],
    },
  ],
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('RulesEngineClient', () => {
  it('posts the project to /evaluate with the internal token and maps the response', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => engineResponse,
    } as Response);
    vi.stubGlobal('fetch', fetchMock);

    const approvals = await new RulesEngineClient(options).evaluate(input, 'project-123');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe('http://python.internal/evaluate');
    expect((init as RequestInit).method).toBe('POST');
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers['X-Internal-Token']).toBe('secret-token');
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body).toMatchObject({ rulesVersion: '2026.09', project: { industry: 'food' } });
    expect(body.projectId).toBe('project-123');

    expect(approvals).toHaveLength(1);
    expect(approvals[0]).toMatchObject({
      key: 'food-licence',
      departmentKey: 'fssai',
      reason: 'Food & beverage processing falls under the FSSAI Act.',
      ruleId: 'FSSAI-STATE-001',
    });
    expect(approvals[0]!.documents[0]).toMatchObject({
      key: 'factory-plan',
      name: 'Factory plan',
      required: true,
      mustInclude: ['Plot boundary'],
    });
  });

  it('throws on a non-ok response so the caller can fall back', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 } as Response));
    await expect(new RulesEngineClient(options).evaluate(input, 'project-123')).rejects.toThrow(
      /503/,
    );
  });

  it('throws when the response shape is invalid', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ approvals: [{ key: 'x' }] }),
      } as Response),
    );
    await expect(
      new RulesEngineClient(options).evaluate(input, 'project-123'),
    ).rejects.toBeTruthy();
  });

  it('rejects an unknown department key from the engine', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          approvals: [{ ...engineResponse.approvals[0], departmentKey: 'not-a-department' }],
        }),
      } as Response),
    );
    await expect(
      new RulesEngineClient(options).evaluate(input, 'project-123'),
    ).rejects.toBeTruthy();
  });

  it('classifies a 401 as an unauthorized configuration failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401 } as Response));
    await expect(
      new RulesEngineClient(options).evaluate(input, 'project-123'),
    ).rejects.toMatchObject({ name: 'RulesEngineError', kind: 'unauthorized' });
  });

  it('classifies a network failure as unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')));
    const error = await new RulesEngineClient(options)
      .evaluate(input, 'project-123')
      .catch((e) => e);
    expect(error).toBeInstanceOf(RulesEngineError);
    expect(error.kind).toBe('unreachable');
  });

  it('classifies an invalid response shape as invalid-response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ approvals: [{ key: 'x' }] }),
      } as Response),
    );
    const error = await new RulesEngineClient(options)
      .evaluate(input, 'project-123')
      .catch((e) => e);
    expect(error).toBeInstanceOf(RulesEngineError);
    expect(error.kind).toBe('invalid-response');
  });

  it('throws a blocked failure carrying the engine-reported issues', async () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => logger);
    const blockingIssues = [{ code: 'SUBMISSION_BLOCKED', message: 'Blocked.' }];
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          approvals: engineResponse.approvals,
          blockingIssues,
        }),
      } as Response),
    );

    const error = await new RulesEngineClient(options)
      .evaluate(input, 'project-123')
      .catch((e) => e);

    expect(error).toBeInstanceOf(RulesEngineError);
    expect(error.kind).toBe('blocked');
    expect(error.blockingIssues).toEqual(blockingIssues);
    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({ blockingIssues: expect.any(Array) }),
      expect.stringMatching(/blocking issues/i),
    );
    warn.mockRestore();
  });
});

describe('createRulesEngineClient', () => {
  it('returns null when the engine is not configured', () => {
    expect(
      createRulesEngineClient({ RULES_VERSION: '2026.09', RULES_SERVICE_TIMEOUT_MS: 5_000 }),
    ).toBeNull();
  });

  it('returns a client when URL and token are set', () => {
    const client = createRulesEngineClient({
      RULES_SERVICE_URL: 'http://python.internal',
      RULES_SERVICE_TOKEN: 'secret',
      RULES_VERSION: '2026.09',
      RULES_SERVICE_TIMEOUT_MS: 5_000,
    });
    expect(client).toBeInstanceOf(RulesEngineClient);
  });
});
