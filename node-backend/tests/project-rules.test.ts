import { describe, expect, it } from 'vitest';

import { departmentKeys } from '../src/modules/auth/auth.constants.js';
import { deriveApprovals } from '../src/modules/projects/project.rules.js';

describe('deriveApprovals', () => {
  it('recommends four approvals for a basic food project', () => {
    const approvals = deriveApprovals({ industry: 'food', boiler: 'no', wetProcessing: undefined });
    expect(approvals.map((a) => a.title)).toEqual([
      'Food-related licence',
      'Factory registration',
      'Fire safety NOC',
      'Consent to operate',
    ]);
    const licence = approvals.find((a) => a.key === 'food-licence');
    expect(licence?.status).toBe('required');
    expect(licence?.departmentKey).toBe('fssai');
    expect(licence?.documents.length ?? 0).toBeGreaterThan(0);
  });

  it('marks factory registration as required for steel and omits the duplicate', () => {
    const approvals = deriveApprovals({
      industry: 'steel',
      boiler: 'no',
      wetProcessing: undefined,
    });
    const factory = approvals.filter((a) => a.key === 'factory-registration');
    expect(factory).toHaveLength(1);
    expect(factory[0]?.status).toBe('required');
    expect(approvals).toHaveLength(3);
  });

  it('adds a boiler registration when a boiler is present', () => {
    const approvals = deriveApprovals({
      industry: 'food',
      boiler: 'yes',
      wetProcessing: undefined,
    });
    const boiler = approvals.find((a) => a.key === 'boiler-registration');
    expect(boiler?.departmentKey).toBe('steam-boilers');
    expect(approvals).toHaveLength(5);
  });

  it('adds effluent treatment consent for textile wet processing', () => {
    const approvals = deriveApprovals({ industry: 'textile', boiler: 'no', wetProcessing: 'yes' });
    expect(approvals.map((a) => a.title)).toContain('Effluent treatment consent');
    expect(approvals.map((a) => a.title)).toContain('Textile unit registration');
    expect(approvals.map((a) => a.title)).not.toContain('Food-related licence');
    const effluent = approvals.find((a) => a.key === 'effluent-consent');
    expect(effluent?.status).toBe('required');
    expect(effluent?.departmentKey).toBe('mpcb');
  });

  it('always targets a known department and lists documents for every approval', () => {
    const approvals = deriveApprovals({ industry: 'textile', boiler: 'yes', wetProcessing: 'yes' });
    for (const approval of approvals) {
      expect(departmentKeys).toContain(approval.departmentKey);
      expect(approval.documents.length).toBeGreaterThan(0);
      expect(approval.processingDays).toBeGreaterThan(0);
    }
  });
});
