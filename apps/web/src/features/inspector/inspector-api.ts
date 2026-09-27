export type ReviewStatus =
  "pending" | "under_review" | "correction_required" | "approved" | "rejected";

export type AttentionLevel = "standard" | "elevated" | "high_attention";

export interface InspectorApplicationSummary {
  projectId: string;
  approvalId: string;
  approvalKey: string;
  approvalTitle: string;
  enterpriseName: string;
  applicantName: string;
  industry: "food" | "textile" | "steel";
  district: string;
  projectStatus: string;
  reviewStatus: ReviewStatus;
  submittedAt: string;
  dueAt: string | null;
  overdue: boolean;
  attentionScore: number | null;
  attentionLevel: AttentionLevel | null;
}

export interface InspectorDocument {
  id: string;
  projectId: string;
  approvalKey: string;
  documentKey: string;
  version: number;
  fileName: string;
  mimeType: string;
  detectedMimeType: string | null;
  sizeBytes: number;
  fileReadStatus: string;
  extractionStatus: string;
  expiresOn: string | null;
  createdAt: string;
  review: {
    status: "pending" | "accepted" | "correction_required" | "rejected";
    comment: string | null;
    inspectorId: string | null;
    reviewedAt: string | null;
  };
}

export interface InspectorApproval {
  id: string;
  approvalKey: string;
  title: string;
  requirementStatus: "required" | "recommended";
  reviewStatus: ReviewStatus;
  decisionNote: string | null;
  reviewStartedAt: string | null;
  decidedAt: string | null;
  processingDays: number;
  documents: { key: string; name: string; required?: boolean }[];
}

export interface ClarificationRequest {
  id: string;
  projectId: string;
  approvalId: string;
  documentId: string | null;
  inspectorName: string;
  message: string;
  status: "open" | "responded" | "resolved";
  dueAt: string | null;
  createdAt: string;
  responses: {
    id: string;
    applicantName: string;
    message: string;
    createdAt: string;
  }[];
}

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
  | "matched"
  | "mismatched"
  | "unavailable"
  | "review_required";

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

export interface InspectorApplication {
  projectId: string;
  enterpriseName: string;
  industry: "food" | "textile" | "steel";
  district: string;
  primaryActivity: string;
  projectStatus: string;
  submittedAt: string;
  applicant: { id: string; name: string; phoneNumber: string };
  details: Record<string, unknown>;
  attention: AttentionAssessment | null;
  validation: ValidationFlags | null;
  approvals: InspectorApproval[];
  documents: InspectorDocument[];
  clarifications: ClarificationRequest[];
}

export class InspectorApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = "InspectorApiError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/v1/inspector${path}`, {
    ...init,
    credentials: "include",
    headers: init?.body
      ? { "Content-Type": "application/json", ...init.headers }
      : init?.headers,
  });
  const body = (await response.json().catch(() => ({}))) as {
    message?: string;
    code?: string;
  } & T;
  if (!response.ok) {
    throw new InspectorApiError(
      body.message ?? "The inspector service could not complete this request.",
      response.status,
      body.code,
    );
  }
  return body;
}

export async function listInspectorApplications(status?: ReviewStatus, q?: string) {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (q?.trim()) params.set("q", q.trim());
  const search = params.toString() ? `?${params.toString()}` : "";
  const response = await request<{
    data: {
      applications: InspectorApplicationSummary[];
      pagination: {
        page: number;
        pageSize: number;
        total: number;
        totalPages: number;
      };
    };
  }>(`/applications${search}`);
  return response.data;
}

export type ClarificationStatus = "open" | "responded" | "resolved";

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

export interface InspectorDecisionSummary {
  projectId: string;
  approvalId: string;
  approvalKey: string;
  approvalTitle: string;
  enterpriseName: string;
  applicantName: string;
  district: string;
  reviewStatus: ReviewStatus;
  decisionNote: string | null;
  decidedAt: string | null;
  decidedByName: string | null;
  submittedAt: string;
}

export type InspectionStatus = "scheduled" | "completed" | "cancelled";
export type InspectionOutcome = "satisfactory" | "needs_follow_up" | "failed";

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

export async function getInspectorReport() {
  const response = await request<{ data: { report: InspectorReport } }>("/reports");
  return response.data.report;
}

export async function listInspectorInspections() {
  const response = await request<{
    data: { inspections: InspectionSummary[] };
  }>("/inspections");
  return response.data.inspections;
}

export async function scheduleInspection(input: {
  projectId: string;
  approvalId: string;
  scheduledAt: string;
  notes?: string;
}) {
  const response = await request<{ data: { inspection: InspectionSummary } }>(
    "/inspections",
    { method: "POST", body: JSON.stringify(input) },
  );
  return response.data.inspection;
}

export async function updateInspection(
  inspectionId: string,
  input: {
    status?: InspectionStatus;
    outcome?: InspectionOutcome | null;
    scheduledAt?: string;
    notes?: string | null;
  },
) {
  const response = await request<{ data: { inspection: InspectionSummary } }>(
    `/inspections/${inspectionId}`,
    { method: "PATCH", body: JSON.stringify(input) },
  );
  return response.data.inspection;
}

export async function listInspectorClarifications() {
  const response = await request<{
    data: { clarifications: InspectorClarificationSummary[] };
  }>("/clarifications");
  return response.data.clarifications;
}

export async function listInspectorDecisions() {
  const response = await request<{
    data: { decisions: InspectorDecisionSummary[] };
  }>("/decisions");
  return response.data.decisions;
}

export async function getInspectorApplication(projectId: string) {
  const response = await request<{
    data: { application: InspectorApplication };
  }>(`/applications/${projectId}`);
  return response.data.application;
}

export async function startInspectorReview(
  projectId: string,
  approvalId: string,
) {
  const response = await request<{
    data: { application: InspectorApplication };
  }>(`/applications/${projectId}/approvals/${approvalId}/start-review`, {
    method: "POST",
  });
  return response.data.application;
}

export async function reviewInspectorDocument(
  projectId: string,
  documentId: string,
  status: "accepted" | "correction_required" | "rejected",
  comment?: string,
) {
  const response = await request<{ data: { document: InspectorDocument } }>(
    `/applications/${projectId}/documents/${documentId}/review`,
    { method: "POST", body: JSON.stringify({ status, comment }) },
  );
  return response.data.document;
}

export async function decideInspectorApproval(
  projectId: string,
  approvalId: string,
  decision: "approved" | "correction_required" | "rejected",
  note?: string,
) {
  const response = await request<{
    data: { application: InspectorApplication };
  }>(`/applications/${projectId}/approvals/${approvalId}/decision`, {
    method: "POST",
    body: JSON.stringify({ decision, note }),
  });
  return response.data.application;
}

export async function getInspectorDocumentDownload(
  projectId: string,
  documentId: string,
) {
  const response = await request<{ data: { url: string } }>(
    `/applications/${projectId}/documents/${documentId}/download`,
  );
  return response.data.url;
}

export async function createInspectorClarification(
  projectId: string,
  approvalId: string,
  input: { message: string; documentId?: string; dueAt?: string },
) {
  const response = await request<{
    data: { application: InspectorApplication };
  }>(`/applications/${projectId}/approvals/${approvalId}/clarifications`, {
    method: "POST",
    body: JSON.stringify(input),
  });
  return response.data.application;
}

export async function resolveInspectorClarification(
  projectId: string,
  clarificationId: string,
) {
  const response = await request<{
    data: { application: InspectorApplication };
  }>(`/applications/${projectId}/clarifications/${clarificationId}/resolve`, {
    method: "POST",
  });
  return response.data.application;
}
