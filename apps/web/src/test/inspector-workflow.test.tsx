import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { InspectorApplicationView } from "@/features/inspector/inspector-application";
import { InspectorDashboard } from "@/features/inspector/inspector-dashboard";
import type { InspectorApplication } from "@/features/inspector/inspector-api";
import { submitProject } from "@/features/projects/project-api";

const projectId = "11111111-1111-4111-8111-111111111111";
const approvalId = "22222222-2222-4222-8222-222222222222";
const documentId = "33333333-3333-4333-8333-333333333333";

const application = (reviewStatus: "pending" | "under_review" = "pending"): InspectorApplication => ({
  projectId,
  enterpriseName: "Sahyadri Steel Works",
  industry: "steel",
  district: "Pune",
  primaryActivity: "Steel rolling",
  projectStatus: reviewStatus === "pending" ? "submitted" : "under_review",
  submittedAt: "2026-09-21T10:00:00.000Z",
  applicant: { id: "applicant-1", name: "Asha Patil", phoneNumber: "+919876543210" },
  details: { enterpriseName: "Sahyadri Steel Works" },
  approvals: [
    {
      id: approvalId,
      approvalKey: "factory-registration",
      title: "Factory registration",
      requirementStatus: "required",
      reviewStatus,
      decisionNote: null,
      reviewStartedAt: null,
      decidedAt: null,
      processingDays: 15,
      documents: [{ key: "factory-plan", name: "Factory plan", required: true }],
    },
  ],
  documents: [
    {
      id: documentId,
      projectId,
      approvalKey: "factory-registration",
      documentKey: "factory-plan",
      version: 1,
      fileName: "factory-plan.pdf",
      mimeType: "application/pdf",
      detectedMimeType: "application/pdf",
      sizeBytes: 1_000_000,
      fileReadStatus: "readable",
      extractionStatus: "not_run",
      expiresOn: null,
      createdAt: "2026-09-21T10:00:00.000Z",
      review: { status: "pending", comment: null, inspectorId: null, reviewedAt: null },
    },
  ],
});

function renderWithQuery(ui: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("inspector workflow", () => {
  it("renders the department-scoped review queue", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          applications: [
            {
              projectId,
              approvalId,
              approvalKey: "factory-registration",
              approvalTitle: "Factory registration",
              enterpriseName: "Sahyadri Steel Works",
              applicantName: "Asha Patil",
              industry: "steel",
              district: "Pune",
              projectStatus: "submitted",
              reviewStatus: "pending",
              submittedAt: "2026-09-21T10:00:00.000Z",
            },
          ],
          pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
        },
      }),
    }));
    renderWithQuery(<InspectorDashboard />);
    expect(await screen.findByText("Sahyadri Steel Works")).toBeInTheDocument();
    expect(screen.getByText("Factory registration")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /open review/i })).toHaveAttribute(
      "href",
      `/inspector/applications/${projectId}`,
    );
  });

  it("renders a clear empty queue", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: { applications: [], pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 } },
      }),
    }));
    renderWithQuery(<InspectorDashboard />);
    expect(await screen.findByText("No assigned applications")).toBeInTheDocument();
  });

  it("loads the application and starts a pending review", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { application: application("pending") } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { application: application("under_review") } }),
      });
    vi.stubGlobal("fetch", fetchMock);
    renderWithQuery(<InspectorApplicationView projectId={projectId} />);
    expect(await screen.findByText("factory-plan.pdf")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Start review" }));
    await waitFor(() => expect(screen.getAllByText("Under review")).toHaveLength(2));
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      `/api/v1/inspector/applications/${projectId}/approvals/${approvalId}/start-review`,
    );
    expect((fetchMock.mock.calls[1]?.[1] as RequestInit).method).toBe("POST");
  });

  it("protects inspector application routes in the proxy matcher configuration", async () => {
    const { config } = await import("@/proxy");
    expect(config.matcher).toContain("/inspector/applications/:path*");
  });
});

describe("applicant submission API", () => {
  it("submits a draft without calling the Python validation endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { project: { id: projectId, status: "submitted", approvals: [] } } }),
    });
    vi.stubGlobal("fetch", fetchMock);
    await expect(submitProject(projectId)).resolves.toMatchObject({ status: "submitted" });
    expect(fetchMock).toHaveBeenCalledWith(`/api/v1/projects/${projectId}/submit`, {
      method: "POST",
      credentials: "include",
    });
    expect(fetchMock.mock.calls.flat().join(" ")).not.toContain("validate");
  });

  it("shows the missing document names returned by submission checks", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 422,
      json: async () => ({
        code: "REQUIRED_DOCUMENTS_MISSING",
        details: { missingDocuments: ["Factory plan"] },
      }),
    }));
    await expect(submitProject(projectId)).rejects.toThrow(/Factory plan/);
  });
});
