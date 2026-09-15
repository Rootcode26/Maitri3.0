import { describe, expect, it } from 'vitest';

import { registerSchema } from '../src/modules/auth/auth.schemas.js';

const base = {
  name: 'Test User',
  phoneNumber: '+919876543210',
  password: 'strong-password',
};

describe('authentication registration schemas', () => {
  it('accepts an applicant with a supported industry', () => {
    expect(registerSchema.parse({ ...base, role: 'applicant', industry: 'food' })).toEqual({
      ...base,
      role: 'applicant',
      industry: 'food',
    });
  });

  it('accepts an inspector with a supported department', () => {
    expect(registerSchema.parse({ ...base, role: 'inspector', departmentKey: 'mpcb' })).toEqual({
      ...base,
      role: 'inspector',
      departmentKey: 'mpcb',
    });
  });

  it.each(['food', 'textile', 'steel'] as const)('accepts applicant industry %s', (industry) => {
    const parsed = registerSchema.parse({ ...base, role: 'applicant', industry });
    expect(parsed.role === 'applicant' && parsed.industry).toBe(industry);
  });

  it('rejects an inspector without a department', () => {
    expect(() => registerSchema.parse({ ...base, role: 'inspector' })).toThrow();
  });

  it('rejects an applicant without an industry', () => {
    expect(() => registerSchema.parse({ ...base, role: 'applicant' })).toThrow();
  });

  it('rejects the removed admin role and unexpected profile fields', () => {
    expect(() => registerSchema.parse({ ...base, role: 'admin', industry: 'steel' })).toThrow();
    expect(() =>
      registerSchema.parse({
        ...base,
        role: 'applicant',
        industry: 'steel',
        departmentKey: 'mpcb',
      }),
    ).toThrow();
  });
});
