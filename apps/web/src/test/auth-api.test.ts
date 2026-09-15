import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthApiError, getCurrentSession, logoutSession } from "@/lib/auth-api";

const fetchMock = vi.fn();
const user = { id: "user-1", name: "Applicant One", phoneNumber: "+919876543210", role: "applicant", status: "active", departmentId: null, industry: "steel" };
const response = (status: number, body?: unknown) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

vi.stubGlobal("fetch", fetchMock);

describe("authentication API integration", () => {
  beforeEach(() => fetchMock.mockReset());

  it("returns the current user when the access session is valid", async () => {
    fetchMock.mockResolvedValueOnce(response(200, { status: "success", data: { user } }));
    await expect(getCurrentSession()).resolves.toEqual(user);
    expect(fetchMock).toHaveBeenCalledWith("/api/v1/auth/me", expect.objectContaining({ method: "GET", credentials: "include" }));
  });

  it("refreshes an expired access session using the HTTP-only refresh cookie", async () => {
    fetchMock
      .mockResolvedValueOnce(response(401, { code: "JWT_EXPIRED", message: "Expired" }))
      .mockResolvedValueOnce(response(200, { status: "success", data: { user } }));
    await expect(getCurrentSession()).resolves.toEqual(user);
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(["/api/v1/auth/me", "/api/v1/auth/refresh"]);
    expect(fetchMock.mock.calls[1]?.[1]).toEqual(expect.objectContaining({ method: "POST", credentials: "include" }));
  });

  it("returns no session when both access and refresh authentication fail", async () => {
    fetchMock
      .mockResolvedValueOnce(response(401, { code: "AUTHENTICATION_REQUIRED" }))
      .mockResolvedValueOnce(response(401, { code: "REFRESH_TOKEN_REQUIRED" }));
    await expect(getCurrentSession()).resolves.toBeNull();
  });

  it("does not attempt refresh for a non-authentication server failure", async () => {
    fetchMock.mockResolvedValueOnce(response(503, { message: "Unavailable" }));
    await expect(getCurrentSession()).rejects.toMatchObject({ status: 503 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("surfaces refresh infrastructure failures instead of treating them as signed out", async () => {
    fetchMock
      .mockResolvedValueOnce(response(401, { message: "Expired" }))
      .mockResolvedValueOnce(response(503, { message: "Redis unavailable" }));
    await expect(getCurrentSession()).rejects.toBeInstanceOf(AuthApiError);
  });

  it("handles the empty 204 logout response without parsing JSON", async () => {
    const logoutResponse = { ok: true, status: 204, json: vi.fn() };
    fetchMock.mockResolvedValueOnce(logoutResponse);
    await expect(logoutSession()).resolves.toBeUndefined();
    expect(logoutResponse.json).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith("/api/v1/auth/logout", expect.objectContaining({ method: "POST", credentials: "include" }));
  });
});
