import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CertificateVerify } from "@/features/certificates/certificate-verify";
import { verifyCertificate } from "@/features/inspector/inspector-api";

vi.mock("@/features/inspector/inspector-api", () => ({
  verifyCertificate: vi.fn(),
}));

function renderWithQuery(ui: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>{ui}</QueryClientProvider>,
  );
}

describe("CertificateVerify", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows a valid certificate with its details", async () => {
    vi.mocked(verifyCertificate).mockResolvedValue({
      valid: true,
      certificateNumber: "MH-CLR-2026-000001",
      status: "active",
      enterpriseName: "Sahyadri Steel Works",
      district: "Pune",
      issuedAt: "2026-09-28T00:00:00.000Z",
    });

    renderWithQuery(<CertificateVerify code={"a".repeat(24)} />);

    expect(await screen.findByText("Valid certificate")).toBeInTheDocument();
    expect(screen.getByText("MH-CLR-2026-000001")).toBeInTheDocument();
    expect(screen.getByText("Sahyadri Steel Works")).toBeInTheDocument();
  });

  it("shows a revoked certificate as not valid", async () => {
    vi.mocked(verifyCertificate).mockResolvedValue({
      valid: false,
      certificateNumber: "MH-CLR-2026-000002",
      status: "revoked",
      enterpriseName: "Sahyadri Steel Works",
      district: "Pune",
      issuedAt: "2026-09-28T00:00:00.000Z",
    });

    renderWithQuery(<CertificateVerify code={"b".repeat(24)} />);

    expect(await screen.findByText("This certificate has been revoked")).toBeInTheDocument();
  });

  it("shows a not-found message when no certificate matches", async () => {
    vi.mocked(verifyCertificate).mockResolvedValue(null);

    renderWithQuery(<CertificateVerify code={"c".repeat(24)} />);

    await waitFor(() =>
      expect(screen.getByText("No certificate matches this code.")).toBeInTheDocument(),
    );
  });
});
