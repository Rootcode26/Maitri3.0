import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApplicantApplicationDetail } from "@/features/projects/applicant-application-detail";
import { ApplicantApplications } from "@/features/projects/applicant-applications";
import { ApplicantDocuments } from "@/features/projects/applicant-documents";
import { ResumeChecklist } from "@/features/projects/resume-checklist";

const projectId = "11111111-1111-4111-8111-111111111111";
const documentId = "33333333-3333-4333-8333-333333333333";
const summary = {
  id: projectId,
  enterpriseName: "Sahyadri Steel Works",
  industry: "steel",
  district: "Pune",
  primaryActivity: "Steel rolling",
  status: "correction_required",
  createdAt: "2026-09-20T10:00:00.000Z",
  submittedAt: "2026-09-21T10:00:00.000Z",
};
const application = {
  ...summary,
  applicantId: "applicant-1",
  updatedAt: "2026-09-22T10:00:00.000Z",
  details: {
    enterpriseName: summary.enterpriseName,
    furnaceType: "Induction furnace",
  },
  approvals: [
    {
      id: "22222222-2222-4222-8222-222222222222",
      approvalKey: "factory-registration",
      title: "Factory registration",
      status: "required",
      documents: [{ key: "factory-plan", name: "Factory plan" }],
      processingDays: 15,
      department: {
        id: "department-1",
        key: "dish",
        name: "Industrial Safety and Health",
      },
      reviewStatus: "correction_required",
      decisionNote: "Submit a readable plan.",
    },
  ],
  documents: [
    {
      id: documentId,
      projectId,
      approvalKey: "factory-registration",
      approvalTitle: "Factory registration",
      departmentName: "Industrial Safety and Health",
      documentKey: "factory-plan",
      documentName: "Factory plan",
      version: 1,
      fileName: "factory-plan.pdf",
      mimeType: "application/pdf",
      detectedMimeType: "application/pdf",
      sizeBytes: 1000,
      fileReadStatus: "readable",
      extractionStatus: "not_run",
      expiresOn: null,
      createdAt: "2026-09-21T10:00:00.000Z",
      review: {
        status: "correction_required",
        comment: "Upload a clearer scan.",
        reviewedAt: "2026-09-22T10:00:00.000Z",
      },
    },
  ],
  clarifications: [],
  timeline: [
    {
      id: "event-1",
      approvalId: null,
      approvalTitle: null,
      actorName: "Asha Patil",
      actorRole: "applicant",
      fromStatus: "draft",
      toStatus: "submitted",
      note: "Application submitted",
      createdAt: "2026-09-21T10:00:00.000Z",
    },
  ],
};

function renderWithQuery(ui: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>{ui}</QueryClientProvider>,
  );
}

beforeEach(() => vi.restoreAllMocks());

describe("applicant application workspace", () => {
  it("filters the application list and links to project details", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            projects: [
              summary,
              {
                ...summary,
                id: "other",
                enterpriseName: "Konkan Foods",
                industry: "food",
                status: "approved",
              },
            ],
          },
        }),
      }),
    );
    renderWithQuery(<ApplicantApplications />);
    expect(await screen.findByText(summary.enterpriseName)).toBeInTheDocument();
    await userEvent.type(
      screen.getByPlaceholderText(/search by enterprise/i),
      "Konkan",
    );
    expect(screen.queryByText(summary.enterpriseName)).not.toBeInTheDocument();
    expect(screen.getByText("Konkan Foods").closest("a")).toHaveAttribute(
      "href",
      "/applicant/applications/other",
    );
  });

  it("routes a draft to the resumable checklist with a Continue action", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: { projects: [{ ...summary, status: "draft" }] },
        }),
      }),
    );
    renderWithQuery(<ApplicantApplications />);
    const link = (
      await screen.findByText(summary.enterpriseName)
    ).closest("a");
    expect(link).toHaveAttribute(
      "href",
      `/applicant/projects/${projectId}/checklist`,
    );
    expect(screen.getByText(/continue application/i)).toBeInTheDocument();
  });

  it("resumes a saved draft checklist and never submits just by opening it", async () => {
    const draftProject = {
      id: projectId,
      enterpriseName: summary.enterpriseName,
      industry: summary.industry,
      district: summary.district,
      primaryActivity: summary.primaryActivity,
      status: "draft",
      approvals: application.approvals,
      createdAt: summary.createdAt,
    };
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      void init;
      if (String(url).endsWith("/documents"))
        return { ok: true, json: async () => ({ data: { documents: [] } }) };
      return { ok: true, json: async () => ({ data: { project: draftProject } }) };
    });
    vi.stubGlobal("fetch", fetchMock);
    renderWithQuery(<ResumeChecklist projectId={projectId} />);

    // The saved checklist (its persisted approvals) is rendered from the API.
    expect(await screen.findByText(/checklist generated/i)).toBeInTheDocument();
    expect(screen.getByText(/factory registration/i)).toBeInTheDocument();
    // Loading the project must never submit it, and must not create a new one.
    expect(
      fetchMock.mock.calls.some(([u]) => String(u).endsWith("/submit")),
    ).toBe(false);
    expect(
      fetchMock.mock.calls.some(
        ([u, init]) =>
          String(u).endsWith("/api/v1/projects") &&
          (init as RequestInit | undefined)?.method === "POST",
      ),
    ).toBe(false);
  });

  it("shows correction details and uploads a replacement version", async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === "POST")
        return {
          ok: true,
          json: async () => ({
            data: {
              document: {
                ...application.documents[0],
                id: "new-doc",
                version: 2,
                review: { status: "pending", comment: null, reviewedAt: null },
              },
            },
          }),
        };
      return { ok: true, json: async () => ({ data: { application } }) };
    });
    vi.stubGlobal("fetch", fetchMock);
    renderWithQuery(<ApplicantApplicationDetail projectId={projectId} />);
    expect(
      await screen.findByText("Upload a clearer scan."),
    ).toBeInTheDocument();
    const input = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    await userEvent.upload(
      input,
      new File(["%PDF-1.7"], "corrected-plan.pdf", { type: "application/pdf" }),
    );
    expect(
      await screen.findByText(
        "Corrected version uploaded. Run Check documents before resubmitting.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /check and resubmit corrections/i }),
    ).toHaveAttribute("href", `/applicant/projects/${projectId}/checklist`);
    expect(
      fetchMock.mock.calls.some(([, init]) => init?.method === "POST"),
    ).toBe(true);
  });

  it("blocks correction resubmission until the repeated document check passes", async () => {
    const correctionProject = {
      id: projectId,
      enterpriseName: summary.enterpriseName,
      industry: summary.industry,
      district: summary.district,
      primaryActivity: summary.primaryActivity,
      status: "correction_required",
      approvals: application.approvals,
      createdAt: summary.createdAt,
    };
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (String(url).endsWith("/documents"))
        return {
          ok: true,
          json: async () => ({ data: { documents: application.documents } }),
        };
      if (String(url).endsWith("/validate") && init?.method === "POST")
        return {
          ok: true,
          json: async () => ({
            data: {
              validation: {
                validationStatus: "review_required",
                blockingIssues: [
                  {
                    code: "DOCUMENT_VALUE_MISMATCH",
                    message: "The entered PAN differs from the document's PAN.",
                    suggestedAction: "Upload the correct document.",
                    approvalKey: "factory-registration",
                    documentKey: "factory-plan",
                  },
                ],
                warnings: [],
                reviewItems: [],
                documentChecks: [],
              },
            },
          }),
        };
      return {
        ok: true,
        json: async () => ({ data: { project: correctionProject } }),
      };
    });
    vi.stubGlobal("fetch", fetchMock);
    renderWithQuery(<ResumeChecklist projectId={projectId} />);

    expect(
      await screen.findByText(/resubmit corrections for review/i),
    ).toBeInTheDocument();
    const resubmit = screen.getByRole("button", {
      name: /resubmit corrections/i,
    });
    expect(resubmit).toBeDisabled();

    await userEvent.click(
      screen.getByRole("button", { name: /check documents/i }),
    );
    expect(
      await screen.findByText(/entered PAN differs from the document's PAN/i),
    ).toBeInTheDocument();
    expect(resubmit).toBeDisabled();
    expect(
      fetchMock.mock.calls.some(([url]) => String(url).endsWith("/submit")),
    ).toBe(false);
  });

  it("lists all document versions with their application and review state", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url === "/api/v1/projects"
          ? { ok: true, json: async () => ({ data: { projects: [summary] } }) }
          : {
              ok: true,
              json: async () => ({
                data: { documents: application.documents },
              }),
            },
      ),
    );
    renderWithQuery(<ApplicantDocuments />);
    expect(await screen.findByText("Factory plan")).toBeInTheDocument();
    expect(screen.getByText(summary.enterpriseName)).toHaveAttribute(
      "href",
      `/applicant/applications/${projectId}`,
    );
    expect(screen.getAllByText("Correction required").length).toBeGreaterThan(
      0,
    );
  });

  it("renders recoverable error states", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        json: async () => ({ message: "Unavailable" }),
      }),
    );
    renderWithQuery(<ApplicantApplications />);
    expect(
      await screen.findByText("Applications could not be loaded."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeEnabled();
  });
});
