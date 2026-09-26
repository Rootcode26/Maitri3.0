import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Route protection (Next.js 16 "proxy", formerly middleware).
//
// This is an *optimistic* gate for UX only — the backend still enforces real
// authorization on every request. Here we simply keep unauthenticated visitors
// out of the workspaces and stop each role from wandering into the other's area.
//
// Only the access-token cookie (Path=/) counts as a session. The refresh token
// is deliberately path-scoped to the auth API by the backend, so it is not — and
// must not be — treated as proof of a session here.

const ACCESS_TOKEN_COOKIE = "access_token";

const APPLICANT_LOGIN = "/auth/login";
const INSPECTOR_LOGIN = "/inspector/login";

type Role = "applicant" | "inspector";

function readRole(token: string): Role | null {
  try {
    const segment = token.split(".")[1];
    if (!segment) return null;
    let b64 = segment.replace(/-/g, "+").replace(/_/g, "/");
    b64 += "=".repeat((4 - (b64.length % 4)) % 4);
    const claims = JSON.parse(atob(b64)) as { role?: unknown };
    return claims.role === "applicant" || claims.role === "inspector"
      ? claims.role
      : null;
  } catch {
    return null;
  }
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const isInspectorArea = pathname.startsWith("/inspector");
  const token = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value ?? null;

  // Not signed in → send to the right login, remembering where they wanted to go.
  if (!token) {
    const loginUrl = new URL(
      isInspectorArea ? INSPECTOR_LOGIN : APPLICANT_LOGIN,
      request.url,
    );
    loginUrl.searchParams.set("next", pathname + search);
    return NextResponse.redirect(loginUrl);
  }

  // Signed in → keep each role in its own workspace. If the role can't be read
  // (opaque/expired token), let it through and let the page + backend decide.
  const role = readRole(token);
  if (role === "applicant" && isInspectorArea) {
    return NextResponse.redirect(new URL("/applicant/dashboard", request.url));
  }
  if (role === "inspector" && !isInspectorArea) {
    return NextResponse.redirect(new URL("/inspector/dashboard", request.url));
  }

  return NextResponse.next();
}

// The public auth pages (/auth/*, /inspector/login, /inspector/register) are not
// listed here, so the proxy never runs on them.
export const config = {
  matcher: [
    "/applicant/:path*",
    "/inspector/dashboard/:path*",
    "/inspector/applications/:path*",
  ],
};
