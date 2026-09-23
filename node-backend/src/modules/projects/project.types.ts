import type { ApprovalStatus } from './project.rules.js';
import type { CreateProjectInput } from './project.schemas.js';

export type Industry = 'food' | 'textile' | 'steel';
export type ProjectStatus =
  'draft' | 'submitted' | 'under_review' | 'correction_required' | 'approved' | 'rejected';
export type ApprovalReviewStatus =
  'pending' | 'under_review' | 'correction_required' | 'approved' | 'rejected';

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
  reviewStatus: ApprovalReviewStatus;
  reviewStartedAt: string | null;
  decidedAt: string | null;
  decidedBy: string | null;
  decisionNote: string | null;
}

export interface ProjectSummary {
  id: string;
  enterpriseName: string;
  industry: Industry;
  district: string;
  primaryActivity: string;
  status: ProjectStatus;
  createdAt: string;
  submittedAt: string | null;
}

export interface ProjectRecord extends ProjectSummary {
  applicantId: string;
  details: CreateProjectInput;
  approvals: ProjectApprovalRecord[];
  updatedAt: string;
}

export interface ApplicantClarification {
  id: string;
  projectId: string;
  approvalId: string;
  approvalTitle: string;
  departmentName: string;
  documentId: string | null;
  documentName: string | null;
  inspectorName: string;
  message: string;
  status: 'open' | 'responded' | 'resolved';
  dueAt: string | null;
  createdAt: string;
  updatedAt: string;
  responses: {
    id: string;
    message: string;
    createdAt: string;
  }[];
}
