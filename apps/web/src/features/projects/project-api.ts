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
}

export interface Project {
  id: string;
  enterpriseName: string;
  industry: "food" | "textile" | "steel";
  district: string;
  primaryActivity: string;
  status: string;
  approvals: ProjectApproval[];
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
export function buildProjectPayload(a: Record<string, string>): Record<string, unknown> {
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

export async function createProject(answers: Record<string, string>): Promise<Project> {
  let response: Response;
  try {
    response = await fetch("/api/v1/projects", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildProjectPayload(answers)),
    });
  } catch {
    throw new ProjectApiError("We could not reach the service. Check your connection and try again.", 0);
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
      throw new ProjectApiError("Please sign in to save this project.", 401, body.code);
    }
    if (response.status === 422) {
      const messages = (body.details?.blockingIssues ?? []).map((issue) => issue.message).filter(Boolean);
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
    throw new ProjectApiError(body.message ?? "Could not save the project. Please try again.", response.status, body.code);
  }

  return body.data!.project;
}

export async function listDepartments(): Promise<Department[]> {
  const response = await fetch("/api/v1/departments", { credentials: "include" });
  const body = (await response.json().catch(() => ({}))) as { data?: { departments: Department[] } };
  if (!response.ok || !body.data) throw new ProjectApiError("Could not load departments.", response.status);
  return body.data.departments;
}

export async function updateApprovalDepartment(
  projectId: string,
  approvalId: string,
  departmentKey: string,
): Promise<ProjectApproval> {
  const response = await fetch(`/api/v1/projects/${projectId}/approvals/${approvalId}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ departmentKey }),
  });
  const body = (await response.json().catch(() => ({}))) as { data?: { approval: ProjectApproval } };
  if (!response.ok || !body.data) throw new ProjectApiError("Could not update the department.", response.status);
  return body.data.approval;
}
