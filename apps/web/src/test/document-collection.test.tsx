import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DocumentCollection } from "@/features/projects/document-collection";
import type { ApprovalDocument, ProjectDocument } from "@/features/projects/project-api";

const documents: ApprovalDocument[] = [
  { key: "factory-floor-plan", name: "Factory floor plan", required: true, formats: ["PDF"], maxSizeMb: 5 },
  { key: "machinery-list", name: "Machinery list", required: true, formats: ["PDF"], maxSizeMb: 5 },
];

const uploadedDoc: ProjectDocument = {
  id: "doc-1",
  approvalKey: "factory-registration",
  documentKey: "factory-floor-plan",
  version: 1,
  fileName: "plan.pdf",
  mimeType: "application/pdf",
  detectedMimeType: "application/pdf",
  sizeBytes: 1000,
  fileReadStatus: "readable",
  extractionStatus: "not_run",
  expiresOn: null,
  createdAt: "2026-09-19T00:00:00.000Z",
};

const renderCollection = (props: Partial<React.ComponentProps<typeof DocumentCollection>> = {}) =>
  render(
    <DocumentCollection
      projectId="project-1"
      approvalKey="factory-registration"
      approvalTitle="Factory registration"
      documents={documents}
      uploaded={[]}
      onBack={vi.fn()}
      {...props}
    />,
  );

const fileInput = () => document.querySelector('input[type="file"]') as HTMLInputElement;

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("DocumentCollection", () => {
  it("renders an empty state instead of crashing when there are no documents", () => {
    expect(() => renderCollection({ documents: [] })).not.toThrow();
    expect(screen.getByText(/no documents are required/i)).toBeInTheDocument();
  });

  it("renders the first document's spec when documents are present", () => {
    renderCollection();
    expect(screen.getByRole("heading", { name: "Factory floor plan" })).toBeInTheDocument();
    expect(screen.getByText(/0 of 2 files uploaded/i)).toBeInTheDocument();
  });

  it("shows an already-uploaded document from server state", () => {
    renderCollection({ uploaded: [uploadedDoc] });
    expect(screen.getByText("plan.pdf")).toBeInTheDocument();
    expect(screen.getByText(/1 of 2 files uploaded/i)).toBeInTheDocument();
  });

  it("uploads a chosen file and reflects the server result", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ data: { document: uploadedDoc } }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const onUploadedChange = vi.fn();
    renderCollection({ onUploadedChange });

    await userEvent.upload(
      fileInput(),
      new File(["%PDF-1.7 data"], "plan.pdf", { type: "application/pdf" }),
    );

    await waitFor(() => expect(screen.getByText("plan.pdf")).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/v1/projects/project-1/documents");
    expect((init as RequestInit).method).toBe("POST");
    expect((init as RequestInit).body).toBeInstanceOf(FormData);
    expect(onUploadedChange).toHaveBeenCalledWith([uploadedDoc]);
  });

  it("rejects a wrong file type locally without calling the server", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    renderCollection();

    await userEvent.upload(fileInput(), new File(["hello"], "note.txt", { type: "text/plain" }), {
      applyAccept: false,
    });

    expect(await screen.findByText(/File must be PDF\./i)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("surfaces a server upload error", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ code: "UNSUPPORTED_FILE_TYPE" }),
    });
    vi.stubGlobal("fetch", fetchMock);
    renderCollection();

    await userEvent.upload(
      fileInput(),
      new File(["%PDF-1.7 data"], "plan.pdf", { type: "application/pdf" }),
    );

    expect(await screen.findByText(/type is not accepted/i)).toBeInTheDocument();
  });
});
