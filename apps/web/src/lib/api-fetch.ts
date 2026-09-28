// Shared fetch wrapper for authenticated data API calls.
//
// The access-token cookie is short-lived (15 min). On its own, a request made
// after it lapses returns 401 and the caller surfaces "please sign in", even
// though a valid 7-day refresh token is still present. This wrapper transparently
// calls POST /api/v1/auth/refresh once on a 401 and retries the original request,
// so the session renews silently instead of forcing a re-login.
//
// Concurrent 401s share a single in-flight refresh so we never rotate the
// refresh token twice at once.

let inFlightRefresh: Promise<boolean> | null = null;

function refreshSession(): Promise<boolean> {
  inFlightRefresh ??= (async () => {
    try {
      const res = await fetch("/api/v1/auth/refresh", {
        method: "POST",
        credentials: "include",
      });
      return res.ok;
    } catch {
      return false;
    } finally {
      // Let a later (future) 401 trigger a fresh refresh once this one settles.
      setTimeout(() => {
        inFlightRefresh = null;
      }, 0);
    }
  })();
  return inFlightRefresh;
}

export async function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const opts: RequestInit = { credentials: "include", ...init };
  const res = await fetch(input, opts);

  // Only try to recover a genuine 401, and never for the auth endpoints
  // themselves (a 401 there is a real credential failure, not an expired token).
  if (res.status !== 401 || input.includes("/api/v1/auth/")) return res;

  const refreshed = await refreshSession();
  if (!refreshed) return res;

  // Retry once with the freshly-set access-token cookie. Request bodies used by
  // callers (FormData, JSON strings) are safe to reuse across these two calls.
  return fetch(input, opts);
}
