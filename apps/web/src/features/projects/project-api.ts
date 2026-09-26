export type ApprovalStatus = "required" | "recommended";

export interface Department {
  id: string;
  key: string;
  name: string;
}

/** A document to upload for an approval, as enriched by the rules engine. */
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

export interface ProjectApproval {
  id: string;
  approvalKey: string;
  title: string;
  status: ApprovalStatus;
  reason?: string;
  ruleId?: string;
  documents: ApprovalDocument[];
  processingDays: number;
  department: Department;
  reviewStatus?:
    | "pending"
    | "under_review"
    | "correction_required"
    | "approved"
    | "rejected";
  decisionNote?: string | null;
  reviewStartedAt?: string | null;
  decidedAt?: string | null;
}

export interface Project {
  id: string;
  enterpriseName: string;
  industry: "food" | "textile" | "steel";
  district: string;
  primaryActivity: string;
  status: string;
  approvals: ProjectApproval[];
  submittedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  details?: Record<string, unknown>;
}

export interface ProjectSummary {
  id: string;
  enterpriseName: string;
  industry: Project["industry"];
  district: string;
  primaryActivity: string;
  status: string;
  createdAt: string;
  submittedAt: string | null;
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
  status: "open" | "responded" | "resolved";
  dueAt: string | null;
  createdAt: string;
  responses: { id: string; message: string; createdAt: string }[];
}

export async function listProjects(): Promise<ProjectSummary[]> {
  const response = await fetch("/api/v1/projects", { credentials: "include" });
  const body = (await response.json().catch(() => ({}))) as {
    message?: string;
    data?: { projects: ProjectSummary[] };
  };
  if (!response.ok || !body.data) {
    throw new ProjectApiError(
      body.message ?? "Could not load your projects.",
      response.status,
    );
  }
  return body.data.projects;
}

export async function listProjectClarifications(projectId: string) {
  const response = await fetch(`/api/v1/projects/${projectId}/clarifications`, {
    credentials: "include",
  });
  const body = (await response.json().catch(() => ({}))) as {
    message?: string;
    data?: { clarifications: ApplicantClarification[] };
  };
  if (!response.ok || !body.data) {
    throw new ProjectApiError(
      body.message ?? "Could not load clarification requests.",
      response.status,
    );
  }
  return body.data.clarifications;
}

export async function respondToProjectClarification(
  projectId: string,
  clarificationId: string,
  message: string,
) {
  const response = await fetch(
    `/api/v1/projects/${projectId}/clarifications/${clarificationId}/responses`,
    {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    },
  );
  const body = (await response.json().catch(() => ({}))) as {
    message?: string;
    data?: { clarifications: ApplicantClarification[] };
  };
  if (!response.ok || !body.data) {
    throw new ProjectApiError(
      body.message ?? "Could not send your response.",
      response.status,
    );
  }
  return body.data.clarifications;
}

export async function submitProject(projectId: string): Promise<Project> {
  const response = await fetch(`/api/v1/projects/${projectId}/submit`, {
    method: "POST",
    credentials: "include",
  });
  const body = (await response.json().catch(() => ({}))) as {
    message?: string;
    code?: string;
    details?: {
      missingDocuments?: string[];
      blockingIssues?: { code: string; message: string }[];
    };
    data?: { project: Project };
  };
  if (!response.ok || !body.data) {
    if (body.code === "REQUIRED_DOCUMENTS_MISSING") {
      const missing = body.details?.missingDocuments ?? [];
      throw new ProjectApiError(
        missing.length
          ? `Upload these required documents first: ${missing.join(", ")}.`
          : "Upload all required documents before submitting.",
        response.status,
        body.code,
      );
    }
    if (body.code === "SUBMISSION_HAS_BLOCKING_ISSUES") {
      throw new ProjectApiError(
        "Some checks must be resolved before submitting. Run “Check documents” to see what needs fixing.",
        response.status,
        body.code,
      );
    }
    throw new ProjectApiError(
      body.message ?? "Could not submit the application.",
      response.status,
      body.code,
    );
  }
  return body.data.project;
}

export class ProjectApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = "ProjectApiError";
  }
}

const industryMap: Record<string, Project["industry"]> = {
  "Food processing": "food",
  Textiles: "textile",
  "Steel & metals": "steel",
};
const organisationTypeMap: Record<string, string> = {
  "Private limited company": "private-limited",
  "Public limited company": "public-limited",
  Partnership: "partnership",
  Proprietorship: "proprietorship",
  LLP: "llp",
};
const landStatusMap: Record<string, string> = {
  Owned: "owned",
  Leased: "leased",
  "Allotted (MIDC)": "allotted-midc",
  "Under acquisition": "under-acquisition",
};
const projectStageMap: Record<string, string> = {
  "New unit": "new",
  Expansion: "expansion",
  Modernisation: "modernisation",
};

const yesNo = (value: string | undefined): "yes" | "no" | undefined =>
  value === "Yes" ? "yes" : value === "No" ? "no" : undefined;

const clean = (value: string | undefined) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

/** Maps the wizard's display answers to the backend project payload. */
export function buildProjectPayload(
  a: Record<string, string>,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    enterpriseName: clean(a.enterpriseName),
    organisationType: organisationTypeMap[a.orgType ?? ""],
    industry: industryMap[a.industry ?? ""],
    cin: clean(a.cin),
    pan: clean(a.pan),
    gstin: clean(a.gstin),
    udyam: clean(a.udyam),
    district: clean(a.district),
    taluka: clean(a.taluka),
    pincode: clean(a.pincode),
    industrialArea: clean(a.industrialArea),
    plotNumber: clean(a.plotNumber),
    plotArea: clean(a.plotArea),
    builtUpArea: clean(a.builtUpArea),
    landStatus: landStatusMap[a.landStatus ?? ""],
    primaryActivity: clean(a.primaryActivity),
    projectStage: projectStageMap[a.projectStage ?? ""],
    investment: clean(a.investment),
    capacity: clean(a.capacity),
    shifts: clean(a.shifts),
    boiler: yesNo(a.boiler),
    boilerCapacity: clean(a.boilerCapacity),
    boilerPressure: clean(a.boilerPressure),
    hazardousChemicals: yesNo(a.hazardousChemicals),
    processes: a.processes ? a.processes.split(", ").filter(Boolean) : [],
    fssaiCategory: clean(a.fssaiCategory),
    coldStorage: clean(a.coldStorage),
    wetProcessing: yesNo(a.wetProcessing),
    loomsSpindles: clean(a.loomsSpindles),
    furnaceType: clean(a.furnaceType),
    furnaceCapacity: clean(a.furnaceCapacity),
    electricity: clean(a.electricity),
    dgSet: clean(a.dgSet),
    waterUse: clean(a.waterUse),
    waterSource: clean(a.waterSource),
    wastewater: clean(a.wastewater),
    hazardousWaste: yesNo(a.hazardousWaste),
    permanent: clean(a.permanent),
    contract: clean(a.contract),
    womenNight: yesNo(a.womenNight),
    accommodation: clean(a.accommodation),
  };
  // Drop undefined so the backend's optional handling stays clean.
  for (const key of Object.keys(payload)) {
    if (payload[key] === undefined) delete payload[key];
  }
  return payload;
}

export async function createProject(
  answers: Record<string, string>,
): Promise<Project> {
  let response: Response;
  try {
    response = await fetch("/api/v1/projects", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildProjectPayload(answers)),
    });
  } catch {
    throw new ProjectApiError(
      "We could not reach the service. Check your connection and try again.",
      0,
    );
  }

  const body = (await response.json().catch(() => ({}))) as {
    message?: string;
    code?: string;
    data?: { project: Project };
    details?: {
      formErrors?: string[];
      fieldErrors?: Record<string, string[]>;
      blockingIssues?: { code: string; message: string }[];
    };
  };

  if (!response.ok) {
    if (response.status === 401) {
      throw new ProjectApiError(
        "Please sign in to save this project.",
        401,
        body.code,
      );
    }
    if (response.status === 422) {
      const messages = (body.details?.blockingIssues ?? [])
        .map((issue) => issue.message)
        .filter(Boolean);
      const detail = messages.length
        ? `This submission cannot be accepted yet: ${messages.join(" ")}`
        : (body.message ?? "This submission cannot be accepted yet.");
      throw new ProjectApiError(detail, 422, body.code);
    }
    if (response.status === 400) {
      // The backend returns human-readable messages per field; surface them so
      // the applicant knows exactly what to correct instead of a generic notice.
      const messages = [
        ...(body.details?.formErrors ?? []),
        ...Object.values(body.details?.fieldErrors ?? {}).flat(),
      ].filter(Boolean);
      const detail = messages.length
        ? `Some answers need attention: ${messages.join(" ")}`
        : "Some answers need attention before this project can be saved.";
      throw new ProjectApiError(detail, 400, body.code);
    }
    throw new ProjectApiError(
      body.message ?? "Could not save the project. Please try again.",
      response.status,
      body.code,
    );
  }

  return body.data!.project;
}

export async function listDepartments(): Promise<Department[]> {
  const response = await fetch("/api/v1/departments", {
    credentials: "include",
  });
  const body = (await response.json().catch(() => ({}))) as {
    data?: { departments: Department[] };
  };
  if (!response.ok || !body.data)
    throw new ProjectApiError("Could not load departments.", response.status);
  return body.data.departments;
}

export async function updateApprovalDepartment(
  projectId: string,
  approvalId: string,
  departmentKey: string,
): Promise<ProjectApproval> {
  const response = await fetch(
    `/api/v1/projects/${projectId}/approvals/${approvalId}`,
    {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ departmentKey }),
    },
  );
  const body = (await response.json().catch(() => ({}))) as {
    data?: { approval: ProjectApproval };
  };
  if (!response.ok || !body.data)
    throw new ProjectApiError(
      "Could not update the department.",
      response.status,
    );
  return body.data.approval;
}

export interface ProjectDocument {
  id: string;
  projectId?: string;
  approvalKey: string;
  approvalTitle?: string;
  departmentName?: string;
  documentKey: string;
  documentName?: string;
  version: number;
  fileName: string;
  mimeType: string;
  detectedMimeType: string | null;
  sizeBytes: number;
  fileReadStatus: string;
  extractionStatus: string;
  expiresOn: string | null;
  createdAt: string;
  review?: {
    status: "pending" | "accepted" | "correction_required" | "rejected";
    comment: string | null;
    reviewedAt: string | null;
  };
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

export interface ApplicantApplication extends Project {
  applicantId: string;
  details: Record<string, unknown>;
  documents: ProjectDocument[];
  clarifications: ApplicantClarification[];
  timeline: ApplicationStatusEvent[];
}

export async function getApplicantApplication(projectId: string) {
  const response = await fetch(`/api/v1/projects/${projectId}/application`, {
    credentials: "include",
  });
  const body = (await response.json().catch(() => ({}))) as {
    message?: string;
    data?: { application: ApplicantApplication };
  };
  if (!response.ok || !body.data) {
    throw new ProjectApiError(
      body.message ?? "Could not load this application.",
      response.status,
    );
  }
  return body.data.application;
}

export async function listApplicantDocuments() {
  const response = await fetch("/api/v1/projects/documents", {
    credentials: "include",
  });
  const body = (await response.json().catch(() => ({}))) as {
    message?: string;
    data?: { documents: ProjectDocument[] };
  };
  if (!response.ok || !body.data) {
    throw new ProjectApiError(
      body.message ?? "Could not load your documents.",
      response.status,
    );
  }
  return body.data.documents;
}

export async function getProjectDocumentDownload(
  projectId: string,
  documentId: string,
) {
  const response = await fetch(
    `/api/v1/projects/${projectId}/documents/${documentId}/download`,
    {
      credentials: "include",
    },
  );
  const body = (await response.json().catch(() => ({}))) as {
    message?: string;
    data?: { url: string };
  };
  if (!response.ok || !body.data) {
    throw new ProjectApiError(
      body.message ?? "Could not open this document.",
      response.status,
    );
  }
  return body.data.url;
}

export async function listProjectDocuments(
  projectId: string,
): Promise<ProjectDocument[]> {
  const response = await fetch(`/api/v1/projects/${projectId}/documents`, {
    credentials: "include",
  });
  const body = (await response.json().catch(() => ({}))) as {
    data?: { documents: ProjectDocument[] };
  };
  if (!response.ok || !body.data)
    throw new ProjectApiError(
      "Could not load uploaded documents.",
      response.status,
    );
  return body.data.documents;
}

export async function uploadProjectDocument(
  projectId: string,
  approvalKey: string,
  documentKey: string,
  file: File,
): Promise<ProjectDocument> {
  const form = new FormData();
  form.append("approvalKey", approvalKey);
  form.append("documentKey", documentKey);
  form.append("file", file);

  let response: Response;
  try {
    response = await fetch(`/api/v1/projects/${projectId}/documents`, {
      method: "POST",
      credentials: "include",
      body: form,
    });
  } catch {
    throw new ProjectApiError(
      "We could not reach the service. Check your connection and try again.",
      0,
    );
  }

  const body = (await response.json().catch(() => ({}))) as {
    message?: string;
    code?: string;
    data?: { document: ProjectDocument };
  };

  if (!response.ok || !body.data) {
    if (response.status === 401)
      throw new ProjectApiError(
        "Please sign in to upload documents.",
        401,
        body.code,
      );
    if (body.code === "UNSUPPORTED_FILE_TYPE")
      throw new ProjectApiError(
        "That file type is not accepted for this document.",
        400,
        body.code,
      );
    if (body.code === "FILE_TOO_LARGE")
      throw new ProjectApiError(
        body.message ?? "That file is too large.",
        response.status,
        body.code,
      );
    if (body.code === "UPLOADS_NOT_CONFIGURED")
      throw new ProjectApiError(
        "Uploads are not available right now. Please try again later.",
        503,
        body.code,
      );
    throw new ProjectApiError(
      body.message ?? "Could not upload the file. Please try again.",
      response.status,
      body.code,
    );
  }
  return body.data.document;
}

export async function deleteProjectDocument(
  projectId: string,
  documentId: string,
): Promise<void> {
  const response = await fetch(
    `/api/v1/projects/${projectId}/documents/${documentId}`,
    {
      method: "DELETE",
      credentials: "include",
    },
  );
  if (!response.ok && response.status !== 204) {
    throw new ProjectApiError(
      "Could not remove the file. Please try again.",
      response.status,
    );
  }
}

export interface ValidationIssue {
  code: string;
  message: string;
  suggestedAction: string;
  approvalKey?: string | null;
  documentKey?: string | null;
  field?: string | null;
}

export interface DocumentCheck {
  documentId: string;
  approvalKey: string;
  documentKey: string;
  field?: string | null;
  status: "matched" | "mismatched" | "unavailable" | "review_required";
  reason: string;
}

export interface ValidationResult {
  validationStatus: "complete" | "review_required" | "not_evaluated";
  blockingIssues: ValidationIssue[];
  warnings: ValidationIssue[];
  reviewItems: ValidationIssue[];
  documentChecks: DocumentCheck[];
}

export async function validateProjectDocuments(
  projectId: string,
): Promise<ValidationResult> {
  let response: Response;
  try {
    response = await fetch(`/api/v1/projects/${projectId}/validate`, {
      method: "POST",
      credentials: "include",
    });
  } catch {
    throw new ProjectApiError(
      "We could not reach the service. Check your connection and try again.",
      0,
    );
  }

  const body = (await response.json().catch(() => ({}))) as {
    message?: string;
    code?: string;
    data?: { validation: ValidationResult };
  };

  if (!response.ok || !body.data) {
    if (response.status === 401)
      throw new ProjectApiError(
        "Please sign in to validate documents.",
        401,
        body.code,
      );
    if (body.code === "VALIDATION_NOT_CONFIGURED")
      throw new ProjectApiError(
        "Document validation is not available yet.",
        503,
        body.code,
      );
    if (body.code === "VALIDATION_UNAVAILABLE")
      throw new ProjectApiError(
        "The validation service is temporarily unavailable. Please try again shortly.",
        response.status,
        body.code,
      );
    throw new ProjectApiError(
      body.message ?? "Could not validate the documents. Please try again.",
      response.status,
      body.code,
    );
  }
  return body.data.validation;
}
