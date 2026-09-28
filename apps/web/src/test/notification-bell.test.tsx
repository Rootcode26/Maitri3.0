import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { NotificationBell } from "@/features/notifications/notification-bell";

function renderWithQuery(ui: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>{ui}</QueryClientProvider>,
  );
}

const feed = {
  data: {
    unreadCount: 1,
    notifications: [
      {
        id: "n1",
        type: "certificate_issued",
        data: { certificateNumber: "MH-CLR-2026-000001" },
        projectId: "11111111-1111-4111-8111-111111111111",
        read: false,
        createdAt: "2026-09-30T10:00:00.000Z",
      },
    ],
  },
};

describe("NotificationBell", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("shows the unread count and opens the panel with a localized message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => feed }),
    );

    renderWithQuery(<NotificationBell workspace="applicant" />);

    // Unread badge.
    expect(await screen.findByText("1")).toBeInTheDocument();

    // Open the panel.
    await userEvent.click(
      screen.getByRole("button", { name: "Notifications" }),
    );

    expect(
      screen.getByText("Your clearance certificate MH-CLR-2026-000001 is ready"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Mark all read" }),
    ).toBeInTheDocument();
  });

  it("shows an empty state when there is nothing", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue({
          ok: true,
          json: async () => ({ data: { unreadCount: 0, notifications: [] } }),
        }),
    );

    renderWithQuery(<NotificationBell workspace="inspector" />);
    await userEvent.click(
      screen.getByRole("button", { name: "Notifications" }),
    );
    expect(
      screen.getByText("You have no notifications yet."),
    ).toBeInTheDocument();
  });
});
