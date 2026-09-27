import type { CreateProjectInput } from '../projects/project.schemas.js';
import type {
  ApprovalDocument,
  ApprovalReviewStatus,
  Industry,
  ProjectStatus,
} from '../projects/project.types.js';
import type { ProjectDocumentRecord } from '../documents/document.types.js';

export type DocumentReviewStatus = 'pending' | 'accepted' | 'correction_required' | 'rejected';
export type ClarificationStatus = 'open' | 'responded' | 'resolved';

export interface ClarificationResponse {
  id: string;
  applicantId: string;
  applicantName: string;
  message: string;
  createdAt: string;
}

export interface ClarificationRequest {
  id: string;
  projectId: string;
  approvalId: string;
  documentId: string | null;
  inspectorId: string;
  inspectorName: string;
  message: string;
  status: ClarificationStatus;
  dueAt: string | null;
  createdAt: string;
  updatedAt: string;
  responses: ClarificationResponse[];
}

export type AttentionLevel = 'standard' | 'elevated' | 'high_attention';

export interface AttentionFactor {
  code: string;
  label: string;
  points: number;
  explanation: string;
}

export interface AttentionAssessment {
  score: number;
  level: AttentionLevel;
  factors: AttentionFactor[];
}

export interface ValidationFlag {
  code: string;
  message: string;
  suggestedAction: string;
  approvalKey: string | null;
  documentKey: string | null;
  field: string | null;
}

export type ValidationCheckStatus =
  | 'matched'
  | 'mismatched'
  | 'unavailable'
  | 'review_required';

export interface ValidationDocumentCheck {
  approvalKey: string;
  documentKey: string;
  field: string | null;
  status: ValidationCheckStatus;
  reason: string;
}

export interface ValidationFlags {
  warnings: ValidationFlag[];
  reviewItems: ValidationFlag[];
  documentChecks: ValidationDocumentCheck[];
}

export interface InspectorApplicationSummary {
  projectId: string;
  approvalId: string;
  approvalKey: string;
  approvalTitle: string;
  enterpriseName: string;
  applicantName: string;
  industry: Industry;
  district: string;
  projectStatus: ProjectStatus;
  reviewStatus: ApprovalReviewStatus;
  submittedAt: string;
  dueAt: string | null;
  overdue: boolean;
  attentionScore: number | null;
  attentionLevel: AttentionLevel | null;
}

/** A department-wide clarification row for the Clarifications workspace. */
export interface InspectorClarificationSummary {
  id: string;
  projectId: string;
  approvalId: string;
  approvalTitle: string;
  enterpriseName: string;
  applicantName: string;
  district: string;
  message: string;
  status: ClarificationStatus;
  dueAt: string | null;
  createdAt: string;
  updatedAt: string;
  responseCount: number;
  latestResponseAt: string | null;
}

/** Department analytics for the Reports workspace, aggregated from live data. */
export interface InspectorReport {
  totals: {
    assigned: number;
    pending: number;
    underReview: number;
    correctionRequired: number;
    approved: number;
    rejected: number;
    decided: number;
  };
  averageDecisionDays: number | null;
  byApproval: {
    approvalKey: string;
    approvalTitle: string;
    total: number;
    approved: number;
  }[];
  inspections: { scheduled: number; completed: number; cancelled: number };
  clarifications: { open: number; responded: number; resolved: number };
}

export type InspectionStatus = 'scheduled' | 'completed' | 'cancelled';
export type InspectionOutcome = 'satisfactory' | 'needs_follow_up' | 'failed';

/** A scheduled/recorded site inspection for the Inspections workspace. */
export interface InspectionSummary {
  id: string;
  projectId: string;
  approvalId: string;
  approvalTitle: string;
  enterpriseName: string;
  district: string;
  scheduledAt: string;
  status: InspectionStatus;
  outcome: InspectionOutcome | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

/** A department-wide approval row for the Decisions workspace. */
export interface InspectorDecisionSummary {
  projectId: string;
  approvalId: string;
  approvalKey: string;
  approvalTitle: string;
  enterpriseName: string;
  applicantName: string;
  district: string;
  reviewStatus: ApprovalReviewStatus;
  decisionNote: string | null;
  decidedAt: string | null;
  decidedByName: string | null;
  submittedAt: string;
}

export interface InspectorDocument extends Omit<ProjectDocumentRecord, 'storageKey'> {
  review: {
    status: DocumentReviewStatus;
    comment: string | null;
    inspectorId: string | null;
    reviewedAt: string | null;
  };
}

export interface InspectorApproval {
  id: string;
  approvalKey: string;
  title: string;
  requirementStatus: 'required' | 'recommended';
  reviewStatus: ApprovalReviewStatus;
  decisionNote: string | null;
  reviewStartedAt: string | null;
  decidedAt: string | null;
  processingDays: number;
  documents: ApprovalDocument[];
}

export interface InspectorApplicationDetail {
  projectId: string;
  enterpriseName: string;
  industry: Industry;
  district: string;
  primaryActivity: string;
  projectStatus: ProjectStatus;
  submittedAt: string;
  applicant: { id: string; name: string; phoneNumber: string };
  details: CreateProjectInput;
  attention: AttentionAssessment | null;
  validation: ValidationFlags | null;
  approvals: InspectorApproval[];
  documents: InspectorDocument[];
  clarifications: ClarificationRequest[];
}
