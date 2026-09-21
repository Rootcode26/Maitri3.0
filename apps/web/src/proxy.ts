import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const ACCESS_TOKEN_COOKIE = "access_token";

export function proxy(request: NextRequest) {
  const hasSession = request.cookies.has(ACCESS_TOKEN_COOKIE);
  if (hasSession) return NextResponse.next();

  const { pathname } = request.nextUrl;
  const loginPath = pathname.startsWith("/inspector") ? "/inspector/login" : "/auth/login";
  const loginUrl = new URL(loginPath, request.url);
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/applicant/:path*", "/inspector/dashboard/:path*", "/inspector/applications/:path*"],
};
