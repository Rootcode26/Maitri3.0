import { cookies } from "next/headers";
import { redirect } from "next/navigation";

// The portal has no separate landing/"choose your workspace" page: the root
// sends signed-in users straight to their dashboard, and everyone else to the
// login screen (which itself carries the applicant/inspector toggle).

const ACCESS_TOKEN_COOKIE = "access_token";

function readRole(token: string): "applicant" | "inspector" | null {
  try {
    const segment = token.split(".")[1];
    if (!segment) return null;
    let b64 = segment.replace(/-/g, "+").replace(/_/g, "/");
    b64 += "=".repeat((4 - (b64.length % 4)) % 4);
    const claims = JSON.parse(Buffer.from(b64, "base64").toString("utf8")) as {
      role?: unknown;
    };
    return claims.role === "applicant" || claims.role === "inspector"
      ? claims.role
      : null;
  } catch {
    return null;
  }
}

export default async function Home() {
  const token = (await cookies()).get(ACCESS_TOKEN_COOKIE)?.value;
  const role = token ? readRole(token) : null;

  if (role === "inspector") redirect("/inspector/dashboard");
  if (role === "applicant") redirect("/applicant/dashboard");
  redirect("/auth/login");
}
