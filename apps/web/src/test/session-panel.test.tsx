import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SessionPanel } from "@/features/auth/session-panel";

const push = vi.fn();
const refresh = vi.fn();
const fetchMock = vi.fn();
const user = { id: "user-1", name: "Inspector One", phoneNumber: "+919876543210", role: "inspector", status: "active", departmentId: "department-1", industry: null };

vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));
vi.stubGlobal("fetch", fetchMock);

function renderPanel() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={client}><SessionPanel /></QueryClientProvider>);
}

describe("session panel", () => {
  beforeEach(() => { push.mockReset(); refresh.mockReset(); fetchMock.mockReset(); });

  it("shows the authenticated user and maps the inspector role to its label", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ data: { user } }) });
    renderPanel();
    expect(await screen.findByText(/signed in as/i)).toHaveTextContent("Inspector One · Inspector");
  });

  it("logs out, clears the visible session and refreshes navigation", async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ data: { user } }) })
      .mockResolvedValueOnce({ ok: true, status: 204, json: vi.fn() });
    const userEventInstance = userEvent.setup();
    renderPanel();
    await userEventInstance.click(await screen.findByRole("button", { name: /sign out/i }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/"));
    expect(screen.queryByText(/signed in as/i)).not.toBeInTheDocument();
  });

  it("stays unobtrusive when no refreshable session exists", async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) });
    renderPanel();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole("region", { name: /current session/i })).not.toBeInTheDocument();
  });
});
