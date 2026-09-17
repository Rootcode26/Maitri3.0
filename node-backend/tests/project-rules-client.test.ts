import { afterEach, describe, expect, it, vi } from 'vitest';

import { createProjectSchema } from '../src/modules/projects/project.schemas.js';
import {
  RulesEngineClient,
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

    const approvals = await new RulesEngineClient(options).evaluate(input);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe('http://python.internal/evaluate');
    expect((init as RequestInit).method).toBe('POST');
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers['X-Internal-Token']).toBe('secret-token');
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body).toMatchObject({ rulesVersion: '2026.09', project: { industry: 'food' } });
    expect(typeof body.projectId).toBe('string');

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
    await expect(new RulesEngineClient(options).evaluate(input)).rejects.toThrow(/503/);
  });

  it('throws when the response shape is invalid', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ approvals: [{ key: 'x' }] }) } as Response),
    );
    await expect(new RulesEngineClient(options).evaluate(input)).rejects.toBeTruthy();
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
    await expect(new RulesEngineClient(options).evaluate(input)).rejects.toBeTruthy();
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
