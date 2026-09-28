import { localPreviewEnabled } from "@/lib/local-preview";

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
  assignedTo: string | null;
  assigneeName: string | null;
}

export interface DepartmentOfficer {
  id: string;
  name: string;
  assignedCount: number;
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
  assignedTo: string | null;
  assigneeName: string | null;
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

export interface ApplicationStatusEvent {
  id: string;
  approvalId: string | null;
  approvalTitle: string | null;
  actorName: string;
  actorRole: "applicant" | "inspector";
  fromStatus: string;
  toStatus: string;
  note: string | null;
  createdAt: string;
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
  timeline: ApplicationStatusEvent[];
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

export interface InspectorQueueFilters {
  status?: ReviewStatus;
  q?: string;
  mine?: boolean;
  unassigned?: boolean;
}

export async function listInspectorApplications(filters: InspectorQueueFilters = {}) {
  if (localPreviewEnabled) {
    return {
      applications: [],
      pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
    };
  }

  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.q?.trim()) params.set("q", filters.q.trim());
  if (filters.mine) params.set("mine", "true");
  if (filters.unassigned) params.set("unassigned", "true");
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

export async function listDepartmentOfficers() {
  const response = await request<{ data?: { officers?: DepartmentOfficer[] } }>(
    "/officers",
  );
  return response.data?.officers ?? [];
}

export async function assignApproval(
  projectId: string,
  approvalId: string,
  assigneeId: string | null,
) {
  const response = await request<{ data: { application: InspectorApplication } }>(
    `/applications/${projectId}/approvals/${approvalId}/assign`,
    { method: "POST", body: JSON.stringify({ assigneeId }) },
  );
  return response.data.application;
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
  if (localPreviewEnabled) {
    return {
      totals: {
        assigned: 0,
        pending: 0,
        underReview: 0,
        correctionRequired: 0,
        approved: 0,
        rejected: 0,
        decided: 0,
      },
      averageDecisionDays: null,
      byApproval: [],
      inspections: { scheduled: 0, completed: 0, cancelled: 0 },
      clarifications: { open: 0, responded: 0, resolved: 0 },
    } satisfies InspectorReport;
  }

  const response = await request<{ data: { report: InspectorReport } }>("/reports");
  return response.data.report;
}

export async function listInspectorInspections() {
  if (localPreviewEnabled) return [];

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
  if (localPreviewEnabled) return [];

  const response = await request<{
    data: { clarifications: InspectorClarificationSummary[] };
  }>("/clarifications");
  return response.data.clarifications;
}

export async function listInspectorDecisions() {
  if (localPreviewEnabled) return [];

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

export type CertificateStatus = "active" | "revoked";

export interface CertificateSummary {
  certificateNumber: string;
  status: CertificateStatus;
  issuedAt: string;
  revokedAt: string | null;
  revokeReason: string | null;
  verifyUrl: string;
}

export interface PublicCertificate {
  valid: boolean;
  certificateNumber: string;
  status: CertificateStatus;
  enterpriseName: string;
  district: string;
  issuedAt: string;
}

/** Certificate for a project in the inspector's department; null if not issued. */
export async function getInspectorCertificate(
  projectId: string,
): Promise<CertificateSummary | null> {
  try {
    const response = await request<{ data: { certificate: CertificateSummary } }>(
      `/applications/${projectId}/certificate`,
    );
    return response.data.certificate;
  } catch (error) {
    if (error instanceof InspectorApiError && error.status === 404) return null;
    throw error;
  }
}

export async function getInspectorCertificateDownloadUrl(
  projectId: string,
): Promise<string> {
  const response = await request<{ data: { url: string } }>(
    `/applications/${projectId}/certificate/download`,
  );
  return response.data.url;
}

export async function revokeInspectorCertificate(
  projectId: string,
  reason: string,
): Promise<CertificateSummary> {
  const response = await request<{ data: { certificate: CertificateSummary } }>(
    `/applications/${projectId}/certificate/revoke`,
    { method: "POST", body: JSON.stringify({ reason }) },
  );
  return response.data.certificate;
}

/** Public, unauthenticated certificate verification. */
export async function verifyCertificate(
  verificationCode: string,
): Promise<PublicCertificate | null> {
  const response = await fetch(`/api/v1/verify/${verificationCode}`, {
    credentials: "include",
  });
  if (response.status === 404) return null;
  const body = (await response.json().catch(() => ({}))) as {
    message?: string;
    data?: { certificate: PublicCertificate };
  };
  if (!response.ok || !body.data) {
    throw new InspectorApiError(
      body.message ?? "Could not verify this certificate.",
      response.status,
    );
  }
  return body.data.certificate;
}
