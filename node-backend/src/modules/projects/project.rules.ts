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
  key: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
  name,
  required: true,
});

const foodLicence: RecommendedApproval = {
  key: 'food-licence',
  title: 'Food-related licence',
  departmentKey: 'fssai',
  status: 'required',
  documents: ['Factory plan', 'Identity proof', 'Water report'].map(doc),
  processingDays: 30,
};

const textileRegistration: RecommendedApproval = {
  key: 'textile-registration',
  title: 'Textile unit registration',
  departmentKey: 'textiles-directorate',
  status: 'required',
  documents: ['Unit plan', 'Machinery list', 'Ownership proof'].map(doc),
  processingDays: 30,
};

const factoryRegistration = (status: ApprovalStatus): RecommendedApproval => ({
  key: 'factory-registration',
  title: 'Factory registration',
  departmentKey: 'dish',
  status,
  documents: ['Floor plan', 'Machinery list', 'Worker details'].map(doc),
  processingDays: 45,
});

const fireNoc: RecommendedApproval = {
  key: 'fire-noc',
  title: 'Fire safety NOC',
  departmentKey: 'fire-emergency-services',
  status: 'recommended',
  documents: ['Fire layout', 'Evacuation plan', 'Site photograph'].map(doc),
  processingDays: 21,
};

const consentToOperate: RecommendedApproval = {
  key: 'consent-to-operate',
  title: 'Consent to operate',
  departmentKey: 'mpcb',
  status: 'recommended',
  documents: ['Water balance', 'Waste declaration', 'Process note'].map(doc),
  processingDays: 60,
};

const boilerRegistration: RecommendedApproval = {
  key: 'boiler-registration',
  title: 'Boiler registration',
  departmentKey: 'steam-boilers',
  status: 'recommended',
  documents: ['Boiler drawing', 'Test certificate', 'Feed-water report'].map(doc),
  processingDays: 30,
};

const effluentConsent: RecommendedApproval = {
  key: 'effluent-consent',
  title: 'Effluent treatment consent',
  departmentKey: 'mpcb',
  status: 'required',
  documents: ['ETP design', 'Water balance', 'Discharge plan'].map(doc),
  processingDays: 45,
};

type DerivationInput = Pick<CreateProjectInput, 'industry' | 'boiler' | 'wetProcessing'>;

export const deriveApprovals = (input: DerivationInput): RecommendedApproval[] => {
  const approvals: RecommendedApproval[] = [];

  if (input.industry === 'textile') {
    approvals.push(textileRegistration);
  } else if (input.industry === 'steel') {
    approvals.push(factoryRegistration('required'));
  } else {
    approvals.push(foodLicence);
  }

  if (input.industry !== 'steel') {
    approvals.push(factoryRegistration('recommended'));
  }

  approvals.push(fireNoc, consentToOperate);

  if (input.boiler === 'yes') {
    approvals.push(boilerRegistration);
  }
  if (input.wetProcessing === 'yes') {
    approvals.push(effluentConsent);
  }

  return approvals;
};
