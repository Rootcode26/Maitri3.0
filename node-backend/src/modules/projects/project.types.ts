import type { ApprovalStatus } from './project.rules.js';
import type { CreateProjectInput } from './project.schemas.js';

export type Industry = 'food' | 'textile' | 'steel';
export type ProjectStatus = 'draft' | 'submitted';

export interface ProjectDepartment {
  id: string;
  key: string;
  name: string;
}

export interface ApprovalDocument {
  key: string;
  name: string;
  description?: string;
  formats?: string[];
  maxSizeMb?: number;
  filesRequired?: number;
  required?: boolean;
  mustInclude?: string[];
  quality?: string[];
}

export interface ProjectApprovalRecord {
  id: string;
  approvalKey: string;
  title: string;
  status: ApprovalStatus;
  reason?: string;
  ruleId?: string;
  documents: ApprovalDocument[];
  processingDays: number;
  department: ProjectDepartment;
}

export interface ProjectSummary {
  id: string;
  enterpriseName: string;
  industry: Industry;
  district: string;
  primaryActivity: string;
  status: ProjectStatus;
  createdAt: string;
}

export interface ProjectRecord extends ProjectSummary {
  applicantId: string;
  details: CreateProjectInput;
  approvals: ProjectApprovalRecord[];
  updatedAt: string;
}
