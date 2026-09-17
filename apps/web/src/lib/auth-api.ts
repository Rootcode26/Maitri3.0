interface ApiErrorBody { message?: string; code?: string }

export type UserRole = "applicant" | "inspector";
export interface AuthUser {
  id: string;
  name: string;
  phoneNumber: string | null;
  role: UserRole;
  status: "pending_verification" | "active" | "suspended";
  departmentId: string | null;
  industry: "food" | "textile" | "steel" | null;
}

interface AuthResponse { status: "success"; data: { user: AuthUser } }

export class AuthApiError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string) {
    super(message);
    this.name = "AuthApiError";
  }
}

const REQUEST_TIMEOUT_MS = 15_000;

async function apiRequest<T>(path: string, init: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(`/api/v1/auth${path}`, { ...init, credentials: "include", signal: controller.signal });
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === "AbortError") {
      throw new AuthApiError("The request timed out. Check your connection and try again.", 0, "REQUEST_TIMEOUT");
    }
    throw cause;
  } finally {
    clearTimeout(timeout);
  }
  if (!response.ok) {
    const error = (await response.json().catch(() => ({}))) as ApiErrorBody;
    throw new AuthApiError(error.message ?? "Something went wrong. Please try again.", response.status, error.code);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export function authRequest<T>(path: string, body: unknown): Promise<T> {
  return apiRequest<T>(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

export async function getCurrentSession(): Promise<AuthUser | null> {
  try {
    return (await apiRequest<AuthResponse>("/me", { method: "GET" })).data.user;
  } catch (cause) {
    if (!(cause instanceof AuthApiError) || cause.status !== 401) throw cause;
  }
  try {
    return (await authRequest<AuthResponse>("/refresh", undefined)).data.user;
  } catch (cause) {
    if (cause instanceof AuthApiError && cause.status === 401) return null;
    throw cause;
  }
}

export const logoutSession = (): Promise<void> => apiRequest("/logout", { method: "POST" });

type AuthAction = "login" | "register" | "verifyOtp" | "resendOtp" | "forgotPassword" | "resetPassword";

export function getAuthErrorMessage(cause: unknown, action: AuthAction): string {
  if (!(cause instanceof AuthApiError)) return "We could not reach the service. Check your connection and try again.";
  if (cause.code === "REQUEST_TIMEOUT") return "The request timed out. Check your connection and try again.";
  if (cause.status >= 500) return "The authentication service is temporarily unavailable. Please try again shortly.";
  if (cause.status === 429) return action === "resendOtp" ? "Too many code requests. Wait a few minutes before trying again." : "Too many attempts. Wait a few minutes and try again.";
  if (cause.code === "WORKSPACE_ACCESS_DENIED") return "This account does not have access to the selected workspace.";
  if (cause.code === "ACCOUNT_INACTIVE") return "This account is not active. Complete mobile verification and try again.";
  if (action === "login" && cause.status === 401) return "The mobile number or password is incorrect.";
  if ((action === "verifyOtp" || action === "resetPassword") && (cause.status === 400 || cause.status === 401)) return "The verification code is incorrect or has expired. Request a new code and try again.";
  if (action === "register" && cause.status === 409) return "An account already exists for this mobile number. Sign in instead.";
  return cause.message;
}
