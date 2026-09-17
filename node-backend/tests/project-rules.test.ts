import { describe, expect, it } from 'vitest';

import { departmentKeys } from '../src/modules/auth/auth.constants.js';
import { deriveApprovals } from '../src/modules/projects/project.rules.js';

const base = {
  boiler: 'no',
  wetProcessing: undefined,
  hazardousChemicals: 'no',
  hazardousWaste: 'no',
  furnaceType: undefined,
  primaryActivity: 'Food & beverage processing',
} as const;

const CANONICAL_KEYS = new Set([
  'food-licence',
  'factory-registration',
  'fire-noc',
  'consent-to-operate',
  'boiler-registration',
]);

describe('deriveApprovals (fallback)', () => {
  it('only ever emits the five canonical approval keys', () => {
    const profiles = [
      { ...base, industry: 'food' as const },
      { ...base, industry: 'textile' as const, wetProcessing: 'yes' as const },
      {
        ...base,
        industry: 'steel' as const,
        furnaceType: 'Induction furnace',
        boiler: 'yes' as const,
      },
    ];
    for (const profile of profiles) {
      for (const approval of deriveApprovals(profile)) {
        expect(CANONICAL_KEYS).toContain(approval.key);
      }
    }
  });

  it('does not emit the retired textile-registration or effluent-consent keys', () => {
    const approvals = deriveApprovals({ ...base, industry: 'textile', wetProcessing: 'yes' });
    const keys = approvals.map((a) => a.key);
    expect(keys).not.toContain('textile-registration');
    expect(keys).not.toContain('effluent-consent');
  });

  it('gives a basic food project a food licence, factory registration and fire NOC', () => {
    const approvals = deriveApprovals({ ...base, industry: 'food' });
    expect(approvals.map((a) => a.key)).toEqual([
      'food-licence',
      'factory-registration',
      'fire-noc',
    ]);
    const licence = approvals.find((a) => a.key === 'food-licence');
    expect(licence?.status).toBe('required');
    expect(licence?.departmentKey).toBe('fssai');
    expect(licence?.documents.length ?? 0).toBeGreaterThan(0);
  });

  it('omits the food licence for non-food industries', () => {
    const approvals = deriveApprovals({ ...base, industry: 'textile', primaryActivity: 'Weaving' });
    expect(approvals.map((a) => a.key)).not.toContain('food-licence');
    expect(approvals.map((a) => a.key)).toEqual(['factory-registration', 'fire-noc']);
  });

  it('adds consent to operate when hazardous chemicals are handled', () => {
    const approvals = deriveApprovals({ ...base, industry: 'food', hazardousChemicals: 'yes' });
    expect(approvals.map((a) => a.key)).toContain('consent-to-operate');
  });

  it('adds consent to operate for textile wet processing', () => {
    const approvals = deriveApprovals({
      ...base,
      industry: 'textile',
      primaryActivity: 'Dyeing & processing',
      wetProcessing: 'yes',
    });
    const consent = approvals.find((a) => a.key === 'consent-to-operate');
    expect(consent?.status).toBe('required');
    expect(consent?.departmentKey).toBe('mpcb');
  });

  it('adds consent to operate for a steel furnace', () => {
    const approvals = deriveApprovals({
      ...base,
      industry: 'steel',
      primaryActivity: 'Foundry / casting',
      furnaceType: 'Induction furnace',
    });
    expect(approvals.map((a) => a.key)).toContain('consent-to-operate');
  });

  it('does not add consent to operate when no pollution trigger is present', () => {
    const approvals = deriveApprovals({
      ...base,
      industry: 'steel',
      primaryActivity: 'Rolling mill',
    });
    expect(approvals.map((a) => a.key)).not.toContain('consent-to-operate');
    expect(approvals.map((a) => a.key)).toEqual(['factory-registration', 'fire-noc']);
  });

  it('adds a boiler registration only when a boiler is present', () => {
    const withBoiler = deriveApprovals({ ...base, industry: 'food', boiler: 'yes' });
    expect(withBoiler.map((a) => a.key)).toContain('boiler-registration');
    const withoutBoiler = deriveApprovals({ ...base, industry: 'food', boiler: 'no' });
    expect(withoutBoiler.map((a) => a.key)).not.toContain('boiler-registration');
  });

  it('can produce all five approvals for a fully-triggered profile', () => {
    const approvals = deriveApprovals({
      ...base,
      industry: 'food',
      boiler: 'yes',
      hazardousChemicals: 'yes',
    });
    expect(approvals.map((a) => a.key).sort()).toEqual(
      [
        'boiler-registration',
        'consent-to-operate',
        'factory-registration',
        'fire-noc',
        'food-licence',
      ].sort(),
    );
  });

  it('always targets a known department and lists documents for every approval', () => {
    const approvals = deriveApprovals({
      ...base,
      industry: 'steel',
      furnaceType: 'Induction furnace',
      boiler: 'yes',
    });
    for (const approval of approvals) {
      expect(departmentKeys).toContain(approval.departmentKey);
      expect(approval.documents.length).toBeGreaterThan(0);
      expect(approval.processingDays).toBeGreaterThan(0);
      expect(approval.status).toBe('required');
    }
  });
});
