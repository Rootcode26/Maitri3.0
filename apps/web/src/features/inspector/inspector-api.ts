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

export async function listInspectorApplications(status?: ReviewStatus) {
  const search = status ? `?status=${encodeURIComponent(status)}` : "";
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
