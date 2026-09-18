import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { proxy } from "@/proxy";

function requestFor(pathname: string, cookie?: string) {
  const headers = new Headers();
  if (cookie) headers.set("cookie", cookie);
  return new NextRequest(new URL(`https://portal.example${pathname}`), { headers });
}

describe("proxy auth gate", () => {
  it("redirects an anonymous visitor away from the applicant dashboard", () => {
    const response = proxy(requestFor("/applicant/dashboard"));
    expect(response.status).toBe(307);
    const location = response.headers.get("location")!;
    expect(new URL(location).pathname).toBe("/auth/login");
    expect(new URL(location).searchParams.get("next")).toBe("/applicant/dashboard");
  });

  it("redirects an anonymous visitor away from the inspector dashboard to the inspector login", () => {
    const response = proxy(requestFor("/inspector/dashboard"));
    const location = new URL(response.headers.get("location")!);
    expect(location.pathname).toBe("/inspector/login");
  });

  it("lets a visitor with the access-token cookie through", () => {
    const response = proxy(requestFor("/applicant/dashboard", "access_token=abc.def.ghi"));
    expect(response.headers.get("location")).toBeNull();
  });

  it("does not treat the path-scoped refresh-token cookie as a session", () => {
    const response = proxy(requestFor("/applicant/dashboard", "refresh_token=abc.def.ghi"));
    expect(response.headers.get("location")).not.toBeNull();
    expect(new URL(response.headers.get("location")!).pathname).toBe("/auth/login");
  });
});
