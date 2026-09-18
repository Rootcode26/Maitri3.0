import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DocumentCollection } from "@/features/projects/document-collection";
import type { ApprovalDocument } from "@/features/projects/project-api";

describe("DocumentCollection", () => {
  it("renders an empty state instead of crashing when there are no documents", () => {
    expect(() =>
      render(
        <DocumentCollection approvalTitle="Consent to operate" documents={[]} onBack={vi.fn()} />,
      ),
    ).not.toThrow();
    expect(screen.getByText(/no documents are required/i)).toBeInTheDocument();
    expect(screen.getByText("Consent to operate")).toBeInTheDocument();
  });

  it("renders the first document's spec when documents are present", () => {
    const documents: ApprovalDocument[] = [
      { key: "factory-floor-plan", name: "Factory floor plan", required: true },
      { key: "machinery-list", name: "Machinery list", required: true },
    ];
    render(
      <DocumentCollection approvalTitle="Factory registration" documents={documents} onBack={vi.fn()} />,
    );
    expect(screen.getByRole("heading", { name: "Factory floor plan" })).toBeInTheDocument();
    expect(screen.getByText(/of 2 files selected/i)).toBeInTheDocument();
    expect(screen.getByText(/Document 1 of 2/i)).toBeInTheDocument();
  });
});
