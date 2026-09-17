import { describe, expect, it } from 'vitest';

import { createProjectSchema } from '../src/modules/projects/project.schemas.js';

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

describe('createProjectSchema', () => {
  it('accepts a valid food project and defaults processes to an empty array', () => {
    const parsed = createProjectSchema.parse(validFoodProject);
    expect(parsed.enterpriseName).toBe('Sahyadri Foods Pvt. Ltd.');
    expect(parsed.processes).toEqual([]);
  });

  it('uppercases and validates the PAN', () => {
    const parsed = createProjectSchema.parse({ ...validFoodProject, pan: 'aabcs1234f' });
    expect(parsed.pan).toBe('AABCS1234F');
  });

  it('rejects an invalid PAN', () => {
    expect(() => createProjectSchema.parse({ ...validFoodProject, pan: '1234567890' })).toThrow();
  });

  it('rejects a missing required field', () => {
    const withoutName: Record<string, unknown> = { ...validFoodProject };
    delete withoutName.enterpriseName;
    expect(() => createProjectSchema.parse(withoutName)).toThrow();
  });

  it('rejects a blank required field', () => {
    expect(() =>
      createProjectSchema.parse({ ...validFoodProject, enterpriseName: '   ' }),
    ).toThrow();
  });

  it('rejects an invalid PIN code', () => {
    expect(() => createProjectSchema.parse({ ...validFoodProject, pincode: '12' })).toThrow();
  });

  it('requires boiler capacity when a boiler is present', () => {
    const result = createProjectSchema.safeParse({ ...validFoodProject, boiler: 'yes' });
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((issue) => issue.path.includes('boilerCapacity'))).toBe(true);
  });

  it('accepts a boiler when its capacity is provided', () => {
    expect(
      createProjectSchema.safeParse({ ...validFoodProject, boiler: 'yes', boilerCapacity: '1–5' })
        .success,
    ).toBe(true);
  });

  it('requires an FSSAI category for food processing', () => {
    const withoutFssai: Record<string, unknown> = { ...validFoodProject };
    delete withoutFssai.fssaiCategory;
    const result = createProjectSchema.safeParse(withoutFssai);
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((issue) => issue.path.includes('fssaiCategory'))).toBe(true);
  });

  it('requires the wet-processing declaration for textiles', () => {
    const result = createProjectSchema.safeParse({
      ...validFoodProject,
      industry: 'textile',
      fssaiCategory: undefined,
      primaryActivity: 'Weaving',
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((issue) => issue.path.includes('wetProcessing'))).toBe(true);
  });

  it('normalises a blank optional field to undefined', () => {
    const parsed = createProjectSchema.parse({ ...validFoodProject, gstin: '', udyam: '  ' });
    expect(parsed.gstin).toBeUndefined();
    expect(parsed.udyam).toBeUndefined();
  });

  it('rejects unknown keys', () => {
    expect(() => createProjectSchema.parse({ ...validFoodProject, hackerField: 'oops' })).toThrow();
  });
});
