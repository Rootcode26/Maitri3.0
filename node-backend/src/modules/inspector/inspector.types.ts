import type { CreateProjectInput } from '../projects/project.schemas.js';
import type {
  ApprovalDocument,
  ApprovalReviewStatus,
  Industry,
  ProjectStatus,
} from '../projects/project.types.js';
import type { ProjectDocumentRecord } from '../documents/document.types.js';

export type DocumentReviewStatus = 'pending' | 'accepted' | 'correction_required' | 'rejected';

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
  approvals: InspectorApproval[];
  documents: InspectorDocument[];
}
