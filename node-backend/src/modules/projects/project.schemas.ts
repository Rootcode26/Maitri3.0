import { z } from 'zod';

import { departmentKeys, industries } from '../auth/auth.constants.js';
import { landStatuses, organisationTypes, projectStages, yesNo } from './project.constants.js';

const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const PINCODE_REGEX = /^[1-9][0-9]{5}$/;

const requiredText = (max: number, label: string) =>
  z.string().trim().min(1, `${label} is required.`).max(max, `${label} is too long.`);

const optionalText = (max: number) =>
  z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
    z.string().trim().max(max).optional(),
  );

const panSchema = z.preprocess(
  (value) => (typeof value === 'string' ? value.trim().toUpperCase() : value),
  z.string().regex(PAN_REGEX, 'Enter a valid 10-character PAN (e.g. AABCS1234F).'),
);

const gstinSchema = z.preprocess(
  (value) =>
    typeof value === 'string'
      ? value.trim() === ''
        ? undefined
        : value.trim().toUpperCase()
      : value,
  z.string().regex(GSTIN_REGEX, 'Enter a valid 15-character GSTIN.').optional(),
);

export const createProjectSchema = z
  .object({
    enterpriseName: requiredText(150, 'Enterprise name'),
    organisationType: z.enum(organisationTypes),
    industry: z.enum(industries),
    cin: optionalText(30),
    pan: panSchema,
    gstin: gstinSchema,
    udyam: optionalText(40),

    district: requiredText(80, 'District'),
    taluka: optionalText(80),
    pincode: z.string().trim().regex(PINCODE_REGEX, 'Enter a valid 6-digit PIN code.'),
    industrialArea: optionalText(120),
    plotNumber: optionalText(80),
    plotArea: requiredText(40, 'Plot area'),
    builtUpArea: optionalText(40),
    landStatus: z.enum(landStatuses),

    primaryActivity: requiredText(80, 'Primary activity'),
    projectStage: z.enum(projectStages),
    investment: optionalText(40),
    capacity: optionalText(60),
    shifts: optionalText(20),
    boiler: z.enum(yesNo),
    boilerCapacity: optionalText(40),
    boilerPressure: optionalText(40),
    hazardousChemicals: z.enum(yesNo),
    processes: z.array(requiredText(80, 'Process')).max(20).default([]),

    fssaiCategory: optionalText(60),
    coldStorage: optionalText(40),
    wetProcessing: z.enum(yesNo).optional(),
    loomsSpindles: optionalText(40),
    furnaceType: optionalText(40),
    furnaceCapacity: optionalText(40),

    electricity: requiredText(40, 'Electricity demand'),
    dgSet: optionalText(40),
    waterUse: requiredText(40, 'Daily water use'),
    waterSource: optionalText(40),
    wastewater: requiredText(60, 'Wastewater discharge'),
    hazardousWaste: z.enum(yesNo),

    permanent: requiredText(40, 'Permanent employees'),
    contract: optionalText(40),
    womenNight: z.enum(yesNo).optional(),
    accommodation: optionalText(60),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.boiler === 'yes' && !value.boilerCapacity) {
      ctx.addIssue({
        code: 'custom',
        path: ['boilerCapacity'],
        message: 'Boiler capacity is required when a boiler is present.',
      });
    }
    if (value.industry === 'food' && !value.fssaiCategory) {
      ctx.addIssue({
        code: 'custom',
        path: ['fssaiCategory'],
        message: 'FSSAI licence category is required for food processing.',
      });
    }
    if (value.industry === 'textile' && !value.wetProcessing) {
      ctx.addIssue({
        code: 'custom',
        path: ['wetProcessing'],
        message: 'Specify whether wet processing (dyeing/bleaching) is involved.',
      });
    }
    if (value.industry === 'steel' && !value.furnaceType) {
      ctx.addIssue({
        code: 'custom',
        path: ['furnaceType'],
        message: 'Furnace type is required for steel and metals.',
      });
    }
  });

export type CreateProjectInput = z.infer<typeof createProjectSchema>;

export const updateApprovalDepartmentSchema = z.object({
  departmentKey: z.enum(departmentKeys),
});
export type UpdateApprovalDepartmentInput = z.infer<typeof updateApprovalDepartmentSchema>;
