import type { departmentKeys } from '../auth/auth.constants.js';
import type { CreateProjectInput } from './project.schemas.js';
import type { ApprovalDocument } from './project.types.js';

export type DepartmentKey = (typeof departmentKeys)[number];
export type ApprovalStatus = 'required' | 'recommended';

export interface RecommendedApproval {
  key: string;
  title: string;
  departmentKey: DepartmentKey;
  status: ApprovalStatus;
  reason?: string;
  ruleId?: string;
  documents: ApprovalDocument[];
  processingDays: number;
}

const doc = (name: string): ApprovalDocument => ({
  key: name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, ''),
  name,
  required: true,
});

const foodLicence: RecommendedApproval = {
  key: 'food-licence',
  title: 'Food-related licence',
  departmentKey: 'fssai',
  status: 'required',
  documents: ['Food premises plan', 'Authorised signatory identity proof'].map(doc),
  processingDays: 30,
};

const factoryRegistration: RecommendedApproval = {
  key: 'factory-registration',
  title: 'Factory registration',
  departmentKey: 'dish',
  status: 'required',
  documents: ['Factory floor plan', 'Machinery list', 'Workforce summary'].map(doc),
  processingDays: 45,
};

const fireNoc: RecommendedApproval = {
  key: 'fire-noc',
  title: 'Fire safety NOC',
  departmentKey: 'fire-emergency-services',
  status: 'required',
  documents: ['Evacuation plan', 'Fire architectural drawings'].map(doc),
  processingDays: 21,
};

const consentToOperate: RecommendedApproval = {
  key: 'consent-to-operate',
  title: 'Consent to operate',
  departmentKey: 'mpcb',
  status: 'required',
  documents: ['Process note', 'Water balance', 'Waste declaration'].map(doc),
  processingDays: 60,
};

const boilerRegistration: RecommendedApproval = {
  key: 'boiler-registration',
  title: 'Boiler registration',
  departmentKey: 'steam-boilers',
  status: 'required',
  documents: ['Boiler drawing', 'Manufacturer / inspection test records'].map(doc),
  processingDays: 30,
};

type DerivationInput = Pick<
  CreateProjectInput,
  | 'industry'
  | 'boiler'
  | 'wetProcessing'
  | 'hazardousChemicals'
  | 'hazardousWaste'
  | 'furnaceType'
  | 'primaryActivity'
>;

export const deriveApprovals = (input: DerivationInput): RecommendedApproval[] => {
  const approvals: RecommendedApproval[] = [];

  if (input.industry === 'food') {
    approvals.push(foodLicence);
  }

  approvals.push(factoryRegistration, fireNoc);

  if (needsConsentToOperate(input)) {
    approvals.push(consentToOperate);
  }
  if (input.boiler === 'yes') {
    approvals.push(boilerRegistration);
  }

  return approvals.map((approval) => structuredClone(approval));
};

const needsConsentToOperate = (input: DerivationInput): boolean =>
  input.hazardousChemicals === 'yes' ||
  input.hazardousWaste === 'yes' ||
  input.wetProcessing === 'yes' ||
  (input.furnaceType !== undefined && input.furnaceType !== 'None') ||
  input.primaryActivity === 'Dyeing & processing' ||
  input.primaryActivity === 'Foundry / casting';
