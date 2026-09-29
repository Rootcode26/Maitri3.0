import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { InspectorApplicationView } from "@/features/inspector/inspector-application";
import { InspectorDashboard } from "@/features/inspector/inspector-dashboard";
import type { InspectorApplication } from "@/features/inspector/inspector-api";
import { ApplicantDashboard } from "@/features/projects/applicant-dashboard";
import { submitProject } from "@/features/projects/project-api";

const projectId = "11111111-1111-4111-8111-111111111111";
const approvalId = "22222222-2222-4222-8222-222222222222";
const documentId = "33333333-3333-4333-8333-333333333333";

const application = (
  reviewStatus: "pending" | "under_review" = "pending",
): InspectorApplication => ({
  projectId,
  enterpriseName: "Sahyadri Steel Works",
  industry: "steel",
  district: "Pune",
  primaryActivity: "Steel rolling",
  projectStatus: reviewStatus === "pending" ? "submitted" : "under_review",
  submittedAt: "2026-09-21T10:00:00.000Z",
  applicant: {
    id: "applicant-1",
    name: "Asha Patil",
    phoneNumber: "+919876543210",
  },
  details: { enterpriseName: "Sahyadri Steel Works" },
  attention: {
    score: 35,
    level: "elevated",
    factors: [
      {
        code: "HAZARDOUS_CHEMICALS",
        label: "Hazardous chemicals on site",
        points: 20,
        explanation: "The applicant reported handling hazardous chemicals.",
      },
    ],
  },
  validation: {
    warnings: [
      {
        code: "DOCUMENT_VALUE_LOOKS_DIFFERENT",
        message: "The PAN in the document looks different from the form.",
        suggestedAction: "Confirm the correct PAN.",
        approvalKey: "factory-registration",
        documentKey: "factory-plan",
        field: "project.pan",
      },
    ],
    reviewItems: [],
    documentChecks: [
      {
        approvalKey: "factory-registration",
        documentKey: "factory-plan",
        field: null,
        status: "review_required",
        reason: "Extraction could not confirm the contents.",
      },
    ],
  },
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
      assignedTo: null,
      assigneeName: null,
      documents: [
        { key: "factory-plan", name: "Factory plan", required: true },
      ],
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
      review: {
        status: "pending",
        comment: null,
        inspectorId: null,
        reviewedAt: null,
      },
    },
  ],
  clarifications: [],
  timeline: [],
});

function renderWithQuery(ui: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>{ui}</QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("inspector workflow", () => {
  it("renders the department-scoped review queue", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
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
                attentionScore: 62,
                attentionLevel: "elevated",
              },
            ],
            pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
          },
        }),
      }),
    );
    renderWithQuery(<InspectorDashboard />);
    expect(await screen.findByText("Sahyadri Steel Works")).toBeInTheDocument();
    expect(screen.getByText("Factory registration")).toBeInTheDocument();
    // The attention estimate is shown as a triage badge on the queue card.
    expect(screen.getByText("Elevated")).toBeInTheDocument();
    expect(screen.getByText(/62/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /open review/i })).toHaveAttribute(
      "href",
      `/inspector/applications/${projectId}`,
    );
  });

  it("renders a clear empty queue", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            applications: [],
            pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
          },
        }),
      }),
    );
    renderWithQuery(<InspectorDashboard />);
    expect(
      await screen.findByText("No assigned applications"),
    ).toBeInTheDocument();
  });

  it("loads the application and starts a pending review", async () => {
    let started = false;
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      void init;
      if (String(url).includes("/officers")) {
        return { ok: true, json: async () => ({ data: { officers: [] } }) };
      }
      if (String(url).includes("/start-review")) {
        started = true;
        return {
          ok: true,
          json: async () => ({
            data: { application: application("under_review") },
          }),
        };
      }
      return {
        ok: true,
        json: async () => ({
          data: { application: application(started ? "under_review" : "pending") },
        }),
      };
    });
    vi.stubGlobal("fetch", fetchMock);
    renderWithQuery(<InspectorApplicationView projectId={projectId} />);
    expect(await screen.findByText("factory-plan.pdf")).toBeInTheDocument();
    // The attention assessment and its contributing factors are shown.
    expect(screen.getByText("Attention assessment")).toBeInTheDocument();
    expect(screen.getByText("Hazardous chemicals on site")).toBeInTheDocument();
    expect(screen.getByText("+20")).toBeInTheDocument();
    // The automated validation flags are shown for the inspector.
    expect(screen.getByText("Automated check flags")).toBeInTheDocument();
    expect(
      screen.getByText("The PAN in the document looks different from the form."),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Start review" }));
    await waitFor(() =>
      expect(screen.getAllByText("Under review")).toHaveLength(2),
    );
    const startCall = fetchMock.mock.calls.find(
      ([callUrl, callInit]) =>
        String(callUrl).includes("/start-review") &&
        (callInit as RequestInit | undefined)?.method === "POST",
    );
    expect(startCall).toBeTruthy();
  });

  it("shows document review completion and marks reviewed documents", async () => {
    const reviewedApplication = application("under_review");
    reviewedApplication.documents[0].review = {
      status: "accepted",
      comment: null,
      inspectorId: "inspector-1",
      reviewedAt: "2026-09-22T10:30:00.000Z",
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (String(url).includes("/officers")) {
          return { ok: true, json: async () => ({ data: { officers: [] } }) };
        }
        return {
          ok: true,
          json: async () => ({ data: { application: reviewedApplication } }),
        };
      }),
    );

    renderWithQuery(<InspectorApplicationView projectId={projectId} />);

    expect(await screen.findByText("Reviewed")).toBeInTheDocument();
    expect(screen.getByText("1 of 1 documents reviewed")).toBeInTheDocument();
    expect(
      screen.getByRole("progressbar", { name: "Document review progress" }),
    ).toHaveAttribute("aria-valuenow", "1");
  });

  it("protects every inspector workspace route", async () => {
    const { config } = await import("@/proxy");
    expect(config.matcher).toEqual(
      expect.arrayContaining([
        "/inspector/dashboard/:path*",
        "/inspector/applications/:path*",
        "/inspector/inspections/:path*",
        "/inspector/clarifications/:path*",
        "/inspector/decisions/:path*",
        "/inspector/reports/:path*",
      ]),
    );
  });

  it("lets an inspector request a clarification after starting review", async () => {
    const updated = application("under_review");
    updated.clarifications = [
      {
        id: "77777777-7777-4777-8777-777777777777",
        projectId,
        approvalId,
        documentId: null,
        inspectorName: "Inspector",
        message: "Please confirm the furnace capacity shown in the plan.",
        status: "open",
        dueAt: null,
        createdAt: "2026-09-22T10:00:00.000Z",
        responses: [],
      },
    ];
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      void init;
      if (String(url).includes("/officers")) {
        return { ok: true, json: async () => ({ data: { officers: [] } }) };
      }
      if (String(url).includes("/clarifications")) {
        return { ok: true, json: async () => ({ data: { application: updated } }) };
      }
      return {
        ok: true,
        json: async () => ({
          data: { application: application("under_review") },
        }),
      };
    });
    vi.stubGlobal("fetch", fetchMock);
    renderWithQuery(<InspectorApplicationView projectId={projectId} />);
    const input = await screen.findByRole("textbox", {
      name: /your message to the applicant/i,
    });
    await userEvent.type(
      input,
      "Please confirm the furnace capacity shown in the plan.",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Request clarification" }),
    );
    expect(
      await screen.findByText(
        "Please confirm the furnace capacity shown in the plan.",
      ),
    ).toBeInTheDocument();
    expect(
      fetchMock.mock.calls.some(([callUrl, callInit]) =>
        String(callUrl).includes("/clarifications") &&
        (callInit as RequestInit | undefined)?.method === "POST",
      ),
    ).toBe(true);
  });
});

describe("applicant clarification workflow", () => {
  it("shows an open clarification and submits the applicant response", async () => {
    const clarification = {
      id: "77777777-7777-4777-8777-777777777777",
      projectId,
      approvalId,
      approvalTitle: "Factory registration",
      departmentName: "Industrial Safety and Health",
      documentId: null,
      documentName: null,
      inspectorName: "Inspector",
      message: "Please confirm the furnace capacity shown in the plan.",
      status: "open",
      dueAt: null,
      createdAt: "2026-09-22T10:00:00.000Z",
      responses: [],
    };
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "/api/v1/projects")
        return {
          ok: true,
          json: async () => ({
            data: {
              projects: [
                {
                  id: projectId,
                  enterpriseName: "Sahyadri Steel Works",
                  industry: "steel",
                  district: "Pune",
                  primaryActivity: "Steel rolling",
                  status: "under_review",
                  createdAt: "2026-09-21T10:00:00.000Z",
                  submittedAt: "2026-09-21T10:00:00.000Z",
                },
              ],
            },
          }),
        };
      if (init?.method === "POST")
        return {
          ok: true,
          json: async () => ({
            data: {
              clarifications: [
                {
                  ...clarification,
                  status: "responded",
                  responses: [
                    {
                      id: "response-1",
                      message: "The capacity is five tonnes.",
                      createdAt: "2026-09-22T11:00:00.000Z",
                    },
                  ],
                },
              ],
            },
          }),
        };
      return {
        ok: true,
        json: async () => ({ data: { clarifications: [clarification] } }),
      };
    });
    vi.stubGlobal("fetch", fetchMock);
    renderWithQuery(<ApplicantDashboard />);
    expect(await screen.findByText(clarification.message)).toBeInTheDocument();
    await userEvent.type(
      screen.getByPlaceholderText(/provide the requested information/i),
      "The capacity is five tonnes.",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Send response" }),
    );
    expect(
      await screen.findByText("The capacity is five tonnes."),
    ).toBeInTheDocument();
    expect(
      fetchMock.mock.calls.some(([, init]) => init?.method === "POST"),
    ).toBe(true);
  });
});

describe("applicant submission API", () => {
  it("submits a draft without calling the Python validation endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          project: { id: projectId, status: "submitted", approvals: [] },
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
    await expect(submitProject(projectId)).resolves.toMatchObject({
      status: "submitted",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/v1/projects/${projectId}/submit`,
      {
        method: "POST",
        credentials: "include",
      },
    );
    expect(fetchMock.mock.calls.flat().join(" ")).not.toContain("validate");
  });

  it("shows the missing document names returned by submission checks", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 422,
        json: async () => ({
          code: "REQUIRED_DOCUMENTS_MISSING",
          details: { missingDocuments: ["Factory plan"] },
        }),
      }),
    );
    await expect(submitProject(projectId)).rejects.toThrow(/Factory plan/);
  });
});
