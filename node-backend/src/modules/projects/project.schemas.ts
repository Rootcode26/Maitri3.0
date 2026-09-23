import { z } from 'zod';

import { departmentKeys, industries } from '../auth/auth.constants.js';
import {
  accommodationOptions,
  boilerCapacityBands,
  builtUpAreaBands,
  coldStorageBands,
  contractBands,
  dgSetBands,
  electricityBands,
  fssaiCategories,
  furnaceCapacityBands,
  furnaceTypes,
  investmentBands,
  landStatuses,
  loomsSpindlesBands,
  organisationTypes,
  permanentBands,
  plotAreaBands,
  primaryActivities,
  processOptions,
  projectStages,
  shiftBands,
  wastewaterOptions,
  waterSources,
  waterUseBands,
  yesNo,
} from './project.constants.js';

const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const PINCODE_REGEX = /^[1-9][0-9]{5}$/;
const NUMBER_TEXT_REGEX = /^[0-9]+(?:\.[0-9]+)?$/;

const requiredText = (max: number, label: string) =>
  z.string().trim().min(1, `${label} is required.`).max(max, `${label} is too long.`);

const optionalText = (max: number) =>
  z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
    z.string().trim().max(max).optional(),
  );

const optionalEnum = <T extends readonly [string, ...string[]]>(values: T) =>
  z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
    z.enum(values).optional(),
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
    plotArea: z.enum(plotAreaBands),
    builtUpArea: optionalEnum(builtUpAreaBands),
    landStatus: z.enum(landStatuses),

    primaryActivity: z.enum(primaryActivities),
    projectStage: z.enum(projectStages),
    investment: optionalEnum(investmentBands),
    capacity: optionalText(60),
    shifts: optionalEnum(shiftBands),
    boiler: z.enum(yesNo),
    boilerCapacity: optionalEnum(boilerCapacityBands),
    boilerPressure: z.preprocess(
      (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
      z
        .string()
        .trim()
        .regex(NUMBER_TEXT_REGEX, 'Enter working pressure as a number (e.g. 10.5).')
        .optional(),
    ),
    hazardousChemicals: z.enum(yesNo),
    processes: z.array(z.enum(processOptions)).max(20).default([]),

    fssaiCategory: optionalEnum(fssaiCategories),
    coldStorage: optionalEnum(coldStorageBands),
    wetProcessing: z.enum(yesNo).optional(),
    loomsSpindles: optionalEnum(loomsSpindlesBands),
    furnaceType: optionalEnum(furnaceTypes),
    furnaceCapacity: optionalEnum(furnaceCapacityBands),

    electricity: z.enum(electricityBands),
    dgSet: optionalEnum(dgSetBands),
    waterUse: z.enum(waterUseBands),
    waterSource: optionalEnum(waterSources),
    wastewater: z.enum(wastewaterOptions),
    hazardousWaste: z.enum(yesNo),

    permanent: z.enum(permanentBands),
    contract: optionalEnum(contractBands),
    womenNight: z.enum(yesNo).optional(),
    accommodation: optionalEnum(accommodationOptions),
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

export const clarificationResponseSchema = z.object({
  message: z.string().trim().min(2).max(2_000),
});
export type ClarificationResponseInput = z.infer<typeof clarificationResponseSchema>;

export const projectClarificationParamsSchema = z.object({
  id: z.uuid(),
  clarificationId: z.uuid(),
});
