import { afterEach, describe, expect, it, vi } from 'vitest';

import { departmentKeys } from '../src/modules/auth/auth.constants.js';
import { deriveApprovals } from '../src/modules/projects/project.rules.js';
import { createProjectSchema } from '../src/modules/projects/project.schemas.js';
import {
  RulesEngineClient,
  RulesEngineError,
} from '../src/modules/projects/project.rules-client.js';

const validFoodProject = {
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
} as const;

const CANONICAL_KEYS = new Set([
  'food-licence',
  'factory-registration',
  'fire-noc',
  'consent-to-operate',
  'boiler-registration',
]);

describe('createProjectSchema — edge cases', () => {
  it('trims surrounding whitespace on required text', () => {
    const parsed = createProjectSchema.parse({
      ...validFoodProject,
      enterpriseName: '  Acme Foods  ',
    });
    expect(parsed.enterpriseName).toBe('Acme Foods');
  });

  it('accepts enterprise name at the 150-char limit and rejects 151', () => {
    expect(
      createProjectSchema.safeParse({ ...validFoodProject, enterpriseName: 'a'.repeat(150) })
        .success,
    ).toBe(true);
    expect(
      createProjectSchema.safeParse({ ...validFoodProject, enterpriseName: 'a'.repeat(151) })
        .success,
    ).toBe(false);
  });

  it('rejects a pincode with a leading zero', () => {
    expect(createProjectSchema.safeParse({ ...validFoodProject, pincode: '012345' }).success).toBe(
      false,
    );
  });

  it('rejects a 5-digit and a 7-digit pincode', () => {
    expect(createProjectSchema.safeParse({ ...validFoodProject, pincode: '41050' }).success).toBe(
      false,
    );
    expect(createProjectSchema.safeParse({ ...validFoodProject, pincode: '4105011' }).success).toBe(
      false,
    );
  });

  it('accepts and uppercases a valid GSTIN, rejects a malformed one', () => {
    const ok = createProjectSchema.parse({ ...validFoodProject, gstin: '27aabcs1234f1z5' });
    expect(ok.gstin).toBe('27AABCS1234F1Z5');
    expect(createProjectSchema.safeParse({ ...validFoodProject, gstin: 'NOTAGSTIN' }).success).toBe(
      false,
    );
  });

  it.each(['organisationType', 'landStatus', 'projectStage', 'industry'] as const)(
    'rejects an unknown enum value for %s',
    (field) => {
      expect(
        createProjectSchema.safeParse({ ...validFoodProject, [field]: 'not-a-real-value' }).success,
      ).toBe(false);
    },
  );

  it('rejects a yes/no field that is not exactly "yes" or "no"', () => {
    expect(createProjectSchema.safeParse({ ...validFoodProject, boiler: 'Yes' }).success).toBe(
      false,
    );
    expect(
      createProjectSchema.safeParse({ ...validFoodProject, hazardousWaste: 'maybe' }).success,
    ).toBe(false);
  });

  it('rejects more than 20 processes and blank process entries', () => {
    expect(
      createProjectSchema.safeParse({
        ...validFoodProject,
        processes: Array.from({ length: 21 }, (_, i) => `p${i}`),
      }).success,
    ).toBe(false);
    expect(createProjectSchema.safeParse({ ...validFoodProject, processes: ['   '] }).success).toBe(
      false,
    );
  });

  it('reports every conditional-required issue at once', () => {
    const result = createProjectSchema.safeParse({
      ...validFoodProject,
      boiler: 'yes',
      fssaiCategory: undefined,
    });
    expect(result.success).toBe(false);
    const paths = result.error!.issues.flatMap((issue) => issue.path);
    expect(paths).toContain('boilerCapacity');
    expect(paths).toContain('fssaiCategory');
  });

  it('requires a furnace type for steel', () => {
    const result = createProjectSchema.safeParse({
      ...validFoodProject,
      industry: 'steel',
      fssaiCategory: undefined,
      primaryActivity: 'Foundry / casting',
    });
    expect(result.success).toBe(false);
    expect(result.error!.issues.some((issue) => issue.path.includes('furnaceType'))).toBe(true);
  });

  it('does not require boiler capacity when there is no boiler', () => {
    expect(createProjectSchema.safeParse(validFoodProject).success).toBe(true);
  });

  it('rejects an over-long optional field (cin > 30 chars)', () => {
    expect(
      createProjectSchema.safeParse({ ...validFoodProject, cin: 'X'.repeat(31) }).success,
    ).toBe(false);
  });

  it('rejects a banded field value outside the shared enum set', () => {
    expect(
      createProjectSchema.safeParse({ ...validFoodProject, plotArea: 'quite large' }).success,
    ).toBe(false);
    expect(
      createProjectSchema.safeParse({ ...validFoodProject, electricity: 'lots' }).success,
    ).toBe(false);
    expect(
      createProjectSchema.safeParse({ ...validFoodProject, permanent: 'a handful' }).success,
    ).toBe(false);
  });

  it('accepts the exact banded enum values the wizard and engine share', () => {
    const parsed = createProjectSchema.parse({
      ...validFoodProject,
      plotArea: '5,000–10,000',
      investment: '₹1,000–5,000 lakh (Medium)',
      waterUse: 'Above 500',
      wastewater: 'No discharge (zero liquid)',
    });
    expect(parsed.plotArea).toBe('5,000–10,000');
    expect(parsed.investment).toBe('₹1,000–5,000 lakh (Medium)');
  });

  it('rejects a process value outside the shared enum set', () => {
    expect(
      createProjectSchema.safeParse({ ...validFoodProject, processes: ['Something made up'] })
        .success,
    ).toBe(false);
  });
});

describe('deriveApprovals — invariants', () => {
  const base = {
    boiler: 'no',
    wetProcessing: undefined,
    hazardousChemicals: 'no',
    hazardousWaste: 'no',
    furnaceType: undefined,
    primaryActivity: 'Food & beverage processing',
  } as const;

  const profiles = [
    { ...base, industry: 'food' as const },
    { ...base, industry: 'food' as const, boiler: 'yes' as const },
    { ...base, industry: 'textile' as const, primaryActivity: 'Weaving' as const },
    {
      ...base,
      industry: 'textile' as const,
      primaryActivity: 'Dyeing & processing' as const,
      wetProcessing: 'yes' as const,
    },
    { ...base, industry: 'steel' as const, primaryActivity: 'Rolling mill' as const },
    {
      ...base,
      industry: 'steel' as const,
      primaryActivity: 'Foundry / casting' as const,
      furnaceType: 'Cupola' as const,
    },
    {
      ...base,
      industry: 'food' as const,
      hazardousChemicals: 'yes' as const,
      hazardousWaste: 'yes' as const,
      boiler: 'yes' as const,
    },
  ];

  it('never emits a non-canonical key, and every approval is well-formed', () => {
    for (const profile of profiles) {
      const approvals = deriveApprovals(profile);
      const keys = approvals.map((a) => a.key);
      for (const key of keys) expect(CANONICAL_KEYS).toContain(key);
      expect(new Set(keys).size).toBe(keys.length);
      expect(keys).toContain('factory-registration');
      expect(keys).toContain('fire-noc');
      for (const approval of approvals) {
        expect(departmentKeys).toContain(approval.departmentKey);
        expect(approval.status).toBe('required');
        expect(approval.processingDays).toBeGreaterThan(0);
        expect(approval.documents.length).toBeGreaterThan(0);
        for (const document of approval.documents) {
          expect(document.key).toBeTruthy();
          expect(document.name).toBeTruthy();
        }
      }
    }
  });

  it('produces consent-to-operate exactly once even when several triggers fire', () => {
    const approvals = deriveApprovals({
      ...base,
      industry: 'steel',
      primaryActivity: 'Foundry / casting' as const,
      furnaceType: 'Induction furnace' as const,
      hazardousChemicals: 'yes',
      hazardousWaste: 'yes',
    });
    expect(approvals.filter((a) => a.key === 'consent-to-operate')).toHaveLength(1);
  });

  it.each([
    ['hazardousChemicals', { hazardousChemicals: 'yes' as const }],
    ['hazardousWaste', { hazardousWaste: 'yes' as const }],
    ['wetProcessing', { wetProcessing: 'yes' as const }],
    ['furnaceType', { furnaceType: 'Electric arc furnace' as const }],
    ['dyeing activity', { primaryActivity: 'Dyeing & processing' as const }],
    ['foundry activity', { primaryActivity: 'Foundry / casting' as const }],
  ])('adds consent-to-operate when triggered by %s', (_label, override) => {
    const approvals = deriveApprovals({ ...base, industry: 'food', ...override });
    expect(approvals.map((a) => a.key)).toContain('consent-to-operate');
  });

  it('omits consent-to-operate for a clean profile with no triggers', () => {
    const approvals = deriveApprovals({ ...base, industry: 'food' });
    expect(approvals.map((a) => a.key)).not.toContain('consent-to-operate');
  });
});

describe('RulesEngineClient — edge cases', () => {
  const input = createProjectSchema.parse(validFoodProject);
  const options = {
    baseUrl: 'http://python.internal',
    token: 'secret-token',
    rulesVersion: '2026.09',
    timeoutMs: 1_000,
  };

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('returns an empty list when the engine reports no approvals', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ approvals: [] }) } as Response),
    );
    await expect(new RulesEngineClient(options).evaluate(input, 'p1')).resolves.toEqual([]);
  });

  it('strips unknown fields the engine may add to an approval', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          approvals: [
            {
              key: 'food-licence',
              title: 'Food-related licence',
              status: 'required',
              departmentKey: 'fssai',
              processingDays: 30,
              documents: [],
              somethingExtra: 'ignore me',
            },
          ],
        }),
      } as Response),
    );
    const approvals = await new RulesEngineClient(options).evaluate(input, 'p1');
    expect(approvals[0]).not.toHaveProperty('somethingExtra');
    expect(approvals[0]!.documents).toEqual([]);
  });

  it('rejects a negative processingDays', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          approvals: [
            {
              key: 'food-licence',
              title: 'X',
              status: 'required',
              departmentKey: 'fssai',
              processingDays: -1,
              documents: [],
            },
          ],
        }),
      } as Response),
    );
    const error = await new RulesEngineClient(options).evaluate(input, 'p1').catch((e) => e);
    expect(error).toBeInstanceOf(RulesEngineError);
    expect(error.kind).toBe('invalid-response');
  });

  it('rejects a zero processingDays (violates the DB positive check)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          approvals: [
            {
              key: 'food-licence',
              title: 'X',
              status: 'required',
              departmentKey: 'fssai',
              processingDays: 0,
              documents: [],
            },
          ],
        }),
      } as Response),
    );
    const error = await new RulesEngineClient(options).evaluate(input, 'p1').catch((e) => e);
    expect(error).toBeInstanceOf(RulesEngineError);
    expect(error.kind).toBe('invalid-response');
  });

  it('rejects over-length key/title/ruleId that would overflow the DB columns', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          approvals: [
            {
              key: 'a'.repeat(61),
              title: 'b'.repeat(121),
              ruleId: 'c'.repeat(101),
              status: 'required',
              departmentKey: 'fssai',
              processingDays: 30,
              documents: [],
            },
          ],
        }),
      } as Response),
    );
    const error = await new RulesEngineClient(options).evaluate(input, 'p1').catch((e) => e);
    expect(error).toBeInstanceOf(RulesEngineError);
    expect(error.kind).toBe('invalid-response');
  });

  it('reports a 500 as a bad-status failure (retryable)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 } as Response));
    const error = await new RulesEngineClient(options).evaluate(input, 'p1').catch((e) => e);
    expect(error.kind).toBe('bad-status');
  });

  it('treats a 422 contract rejection as a loud invalid-response, not a retryable blip', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 422 } as Response));
    const error = await new RulesEngineClient(options).evaluate(input, 'p1').catch((e) => e);
    expect(error.kind).toBe('invalid-response');
  });

  it('treats a 400 bad request as a loud invalid-response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 400 } as Response));
    const error = await new RulesEngineClient(options).evaluate(input, 'p1').catch((e) => e);
    expect(error.kind).toBe('invalid-response');
  });

  it('aborts a slow engine and reports it as unreachable', async () => {
    vi.stubGlobal(
      'fetch',
      (_url: unknown, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () =>
            reject(new DOMException('The operation was aborted.', 'AbortError')),
          );
        }),
    );
    const client = new RulesEngineClient({ ...options, timeoutMs: 10 });
    const error = await client.evaluate(input, 'p1').catch((e) => e);
    expect(error).toBeInstanceOf(RulesEngineError);
    expect(error.kind).toBe('unreachable');
  });
});
