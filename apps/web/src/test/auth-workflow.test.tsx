import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  fireEvent,
  render as testingRender,
  screen,
  waitFor,
} from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Home from "@/app/page";
import { LoginForm } from "@/features/auth/login-form";
import { ForgotPasswordForm } from "@/features/auth/forgot-password-form";
import { OtpForm } from "@/features/auth/otp-form";
import { RegisterForm } from "@/features/auth/register-form";
import { ResetPasswordForm } from "@/features/auth/reset-password-form";

const push = vi.fn();
const refresh = vi.fn();
const searchValues = new Map<string, string>();
const fetchMock = vi.fn();
const authUser = {
  id: "user-1",
  name: "Applicant One",
  phoneNumber: "+919876543210",
  role: "applicant",
  status: "active",
  departmentId: null,
  industry: "steel",
};

function render(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return testingRender(ui, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  });
}

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
  useSearchParams: () => ({
    get: (key: string) => searchValues.get(key) ?? null,
  }),
}));

vi.stubGlobal("fetch", fetchMock);

describe("authentication workflow", () => {
  beforeEach(() => {
    push.mockReset();
    refresh.mockReset();
    searchValues.clear();
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ status: "success", data: { user: authUser } }),
    });
  });

  it("presents separate applicant and inspector workspaces", () => {
    render(<Home />);

    expect(
      screen.getByRole("heading", { name: "Applicant login" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Inspector login" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Admin login" }),
    ).not.toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /continue/i })).toHaveLength(2);
    expect(
      screen
        .getAllByRole("link", { name: /continue/i })
        .map((link) => link.getAttribute("href")),
    ).toEqual(["/auth/login", "/inspector/login"]);
  });

  it("authenticates an applicant and forwards remember-me as false by default", async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.type(
      screen.getByLabelText("Registered mobile number"),
      "9876543210",
    );
    await user.type(screen.getByLabelText("Password"), "strong-password");
    await user.click(
      screen.getByRole("button", { name: /sign in to applicant workspace/i }),
    );

    await waitFor(() => expect(push).toHaveBeenCalledWith("/applicant/dashboard"));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/auth/login",
      expect.objectContaining({
        credentials: "include",
        body: JSON.stringify({
          phoneNumber: "+919876543210",
          password: "strong-password",
          rememberMe: false,
          expectedRole: "applicant",
        }),
      }),
    );
  });

  it("keeps profile attributes out of credential-only login forms", () => {
    const { unmount } = render(<LoginForm />);
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    unmount();
    render(<LoginForm mode="inspector" />);
    expect(
      screen.queryByRole("combobox", { name: "Industry" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("combobox", { name: "Department" }),
    ).not.toBeInTheDocument();
  });

  it("links inspectors to their account creation page", () => {
    render(<LoginForm mode="inspector" />);

    expect(
      screen.getByRole("button", { name: /sign in to inspector workspace/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /create an inspector account/i }),
    ).toHaveAttribute("href", "/inspector/register");
  });

  it("requests a 30-day session when remember me is selected", async () => {
    const user = userEvent.setup();
    render(<LoginForm />);
    await user.type(
      screen.getByLabelText("Registered mobile number"),
      "9876543210",
    );
    await user.type(screen.getByLabelText("Password"), "strong-password");
    const remember = screen.getByRole("checkbox");
    await user.click(remember);
    expect(remember).toHaveAttribute("aria-checked", "true");
    await user.click(
      screen.getByRole("button", { name: /sign in to applicant workspace/i }),
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(
      JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string),
    ).toMatchObject({ rememberMe: true, expectedRole: "applicant" });
  });

  it("registers an applicant and routes to OTP with the applicant role", async () => {
    render(<RegisterForm />);
    fireEvent.change(screen.getByLabelText("Full name"), {
      target: { value: "Applicant One" },
    });
    fireEvent.change(screen.getByLabelText("Mobile number"), {
      target: { value: "9876543210" },
    });
    fireEvent.change(screen.getByLabelText("Create password"), {
      target: { value: "strong-password" },
    });
    fireEvent.submit(
      screen.getByRole("button", { name: /create account/i }).closest("form")!,
    );

    await waitFor(() =>
      expect(push).toHaveBeenCalledWith(
        "/auth/verify-otp?phone=%2B919876543210&role=applicant",
      ),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/auth/register",
      expect.objectContaining({
        body: JSON.stringify({
          name: "Applicant One",
          phoneNumber: "+919876543210",
          password: "strong-password",
          role: "applicant",
          industry: "steel",
        }),
      }),
    );
  });

  it("sends the selected applicant industry to registration", async () => {
    const user = userEvent.setup();
    render(<RegisterForm />);
    const industry = screen.getByRole("combobox", { name: "Industry" });
    await user.selectOptions(industry, "Food");
    await user.type(screen.getByLabelText("Full name"), "Food Applicant");
    await user.type(screen.getByLabelText("Mobile number"), "9876543210");
    await user.type(
      screen.getByLabelText("Create password"),
      "strong-password",
    );
    await user.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/v1/auth/register",
        expect.objectContaining({
          body: JSON.stringify({
            name: "Food Applicant",
            phoneNumber: "+919876543210",
            password: "strong-password",
            role: "applicant",
            industry: "food",
          }),
        }),
      ),
    );
  });

  it("requires a department when registering an inspector", () => {
    render(<RegisterForm inspector />);

    expect(screen.getByText("Select your department")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Select the government department associated with this inspector account.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /register inspector account/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/inspector/login",
    );
  });

  it("sends the selected inspector department to registration and routes to inspector OTP", async () => {
    const user = userEvent.setup();
    render(<RegisterForm inspector />);
    const department = screen.getByRole("combobox", { name: "Department" });
    await user.selectOptions(department, "Maharashtra Pollution Control Board (MPCB)");
    await user.type(screen.getByLabelText("Full name"), "Inspector One");
    await user.type(screen.getByLabelText("Mobile number"), "9876543211");
    await user.type(
      screen.getByLabelText("Create password"),
      "strong-password",
    );
    await user.click(
      screen.getByRole("button", { name: /register inspector account/i }),
    );

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/v1/auth/register",
        expect.objectContaining({
          body: JSON.stringify({
            name: "Inspector One",
            phoneNumber: "+919876543211",
            password: "strong-password",
            role: "inspector",
            departmentKey: "mpcb",
          }),
        }),
      ),
    );
    expect(push).toHaveBeenCalledWith(
      "/auth/verify-otp?phone=%2B919876543211&role=inspector",
    );
  });

  it("masks the phone number on the OTP screen", () => {
    searchValues.set("phone", "+919876543210");
    render(<OtpForm />);

    expect(screen.getByText("+91 ••••• 3210")).toBeInTheDocument();
    expect(screen.getByLabelText("Verification code")).toHaveAttribute(
      "maxlength",
      "6",
    );
    expect(screen.getByLabelText("Verification code")).toHaveAttribute(
      "inputmode",
      "numeric",
    );
    expect(
      screen.getByRole("button", { name: /resend code/i }),
    ).toBeInTheDocument();
  });

  it("does not expose a partial phone number when OTP context is missing", () => {
    render(<OtpForm />);
    expect(
      screen.getByText("your registered mobile number"),
    ).toBeInTheDocument();
  });

  it("shows typed validation errors and does not submit invalid registration data", async () => {
    const user = userEvent.setup();
    render(<RegisterForm />);
    await user.type(screen.getByLabelText("Full name"), "Applicant 123");
    await user.type(screen.getByLabelText("Mobile number"), "12345");
    await user.type(screen.getByLabelText("Create password"), "short");
    await user.click(screen.getByRole("button", { name: /create account/i }));

    expect(
      await screen.findByText(/name can contain letters/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/10-digit indian mobile number starting with/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Password must contain at least 8 characters."),
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows a helpful invalid-credentials error returned by login", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({
        code: "INVALID_CREDENTIALS",
        message: "Unauthorized",
      }),
    });
    const user = userEvent.setup();
    render(<LoginForm />);
    await user.type(
      screen.getByLabelText("Registered mobile number"),
      "9876543210",
    );
    await user.type(screen.getByLabelText("Password"), "wrong-password");
    await user.click(
      screen.getByRole("button", { name: /sign in to applicant/i }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "mobile number or password is incorrect",
    );
    expect(push).not.toHaveBeenCalled();
  });

  it("sends the inspector workspace role and reports cross-workspace access denial", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({
        code: "WORKSPACE_ACCESS_DENIED",
        message: "Forbidden",
      }),
    });
    const user = userEvent.setup();
    render(<LoginForm mode="inspector" />);
    await user.type(
      screen.getByLabelText("Registered mobile number"),
      "9876543210",
    );
    await user.type(screen.getByLabelText("Password"), "strong-password");
    await user.click(
      screen.getByRole("button", { name: /sign in to inspector/i }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "does not have access to the selected workspace",
    );
    expect(
      JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string),
    ).toMatchObject({ expectedRole: "inspector" });
    expect(push).not.toHaveBeenCalled();
  });

  it("validates login locally and preserves entered values", async () => {
    const user = userEvent.setup();
    render(<LoginForm />);
    await user.type(
      screen.getByLabelText("Registered mobile number"),
      "5876543210",
    );
    await user.click(
      screen.getByRole("button", { name: /sign in to applicant/i }),
    );

    expect(
      await screen.findByText(/10-digit indian mobile number starting with/i),
    ).toBeInTheDocument();
    expect(screen.getByText("Enter your password.")).toBeInTheDocument();
    expect(screen.getByLabelText("Registered mobile number")).toHaveValue(
      "5876543210",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("prevents duplicate login submissions while the request is pending", async () => {
    let resolveRequest!: (value: unknown) => void;
    fetchMock.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveRequest = resolve;
      }),
    );
    const user = userEvent.setup();
    render(<LoginForm />);
    await user.type(
      screen.getByLabelText("Registered mobile number"),
      "9876543210",
    );
    await user.type(screen.getByLabelText("Password"), "strong-password");
    const submit = screen.getByRole("button", {
      name: /sign in to applicant/i,
    });
    await user.click(submit);
    expect(submit).toBeDisabled();
    expect(submit).toHaveAttribute("aria-busy", "true");
    await user.click(submit);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    resolveRequest({
      ok: true,
      status: 200,
      json: async () => ({ status: "success", data: { user: authUser } }),
    });
    await waitFor(() => expect(push).toHaveBeenCalledWith("/applicant/dashboard"));
  });

  it("reports an existing account during registration and keeps entered data", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 409,
      json: async () => ({
        code: "PHONE_ALREADY_REGISTERED",
        message: "Conflict",
      }),
    });
    const user = userEvent.setup();
    render(<RegisterForm />);
    await user.type(screen.getByLabelText("Full name"), "Applicant One");
    await user.type(screen.getByLabelText("Mobile number"), "9876543210");
    await user.type(
      screen.getByLabelText("Create password"),
      "strong-password",
    );
    await user.click(screen.getByRole("button", { name: /create account/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "account already exists",
    );
    expect(screen.getByLabelText("Full name")).toHaveValue("Applicant One");
    expect(push).not.toHaveBeenCalled();
  });

  it("rejects an incomplete OTP before contacting the backend", async () => {
    searchValues.set("phone", "+919876543210");
    const user = userEvent.setup();
    render(<OtpForm />);
    await user.type(screen.getByLabelText("Verification code"), "123");
    await user.click(
      screen.getByRole("button", { name: /verify and continue/i }),
    );

    expect(
      await screen.findByText(/complete 6-digit verification code/i),
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports OTP resend throttling without losing the form", async () => {
    searchValues.set("phone", "+919876543210");
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: async () => ({ message: "Rate limited" }),
    });
    const user = userEvent.setup();
    render(<OtpForm />);
    await user.click(screen.getByRole("button", { name: /resend code/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Too many code requests",
    );
    expect(screen.getByLabelText("Verification code")).toBeInTheDocument();
  });

  it("verifies a correct OTP and routes to applicant login", async () => {
    searchValues.set("phone", "+919876543210");
    searchValues.set("role", "applicant");
    const user = userEvent.setup();
    render(<OtpForm />);
    await user.type(screen.getByLabelText("Verification code"), "123456");
    await user.click(
      screen.getByRole("button", { name: /verify and continue/i }),
    );

    await waitFor(() => expect(push).toHaveBeenCalledWith("/auth/login"));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/auth/otp/verify",
      expect.objectContaining({
        body: JSON.stringify({ phoneNumber: "+919876543210", otp: "123456" }),
      }),
    );
  });

  it("shows confirmation after successfully resending an OTP", async () => {
    searchValues.set("phone", "+919876543210");
    const user = userEvent.setup();
    render(<OtpForm />);
    await user.click(screen.getByRole("button", { name: /resend code/i }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      "new verification code has been sent",
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/auth/otp/resend",
      expect.objectContaining({
        body: JSON.stringify({ phoneNumber: "+919876543210" }),
      }),
    );
  });

  it("does not contact the OTP API when verification context is missing", async () => {
    const user = userEvent.setup();
    render(<OtpForm />);
    await user.type(screen.getByLabelText("Verification code"), "123456");
    await user.click(
      screen.getByRole("button", { name: /verify and continue/i }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "details are missing",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("starts password recovery without exposing account existence", async () => {
    const user = userEvent.setup();
    searchValues.set("mode", "applicant");
    render(<ForgotPasswordForm />);

    await user.type(
      screen.getByLabelText("Registered mobile number"),
      "9876543210",
    );
    await user.click(screen.getByRole("button", { name: /send reset code/i }));

    await waitFor(() =>
      expect(push).toHaveBeenCalledWith(
        "/auth/reset-password?phone=%2B919876543210&mode=applicant",
      ),
    );
  });

  it("validates forgot-password phone numbers before submission", async () => {
    const user = userEvent.setup();
    render(<ForgotPasswordForm />);
    await user.type(
      screen.getByLabelText("Registered mobile number"),
      "1234567890",
    );
    await user.click(screen.getByRole("button", { name: /send reset code/i }));
    expect(
      await screen.findByText(/10-digit indian mobile number starting with/i),
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps the user on forgot-password when the service is unavailable", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 503,
      json: async () => ({ message: "Unavailable" }),
    });
    const user = userEvent.setup();
    render(<ForgotPasswordForm />);
    await user.type(
      screen.getByLabelText("Registered mobile number"),
      "9876543210",
    );
    await user.click(screen.getByRole("button", { name: /send reset code/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "temporarily unavailable",
    );
    expect(push).not.toHaveBeenCalled();
  });

  it("submits the reset code and new password, then shows recovery success", async () => {
    const user = userEvent.setup();
    searchValues.set("phone", "+919876543210");
    searchValues.set("mode", "applicant");
    render(<ResetPasswordForm />);

    await user.type(screen.getByLabelText("Reset code"), "123456");
    await user.type(
      screen.getByLabelText("New password"),
      "new-strong-password",
    );
    await user.click(screen.getByRole("button", { name: /update password/i }));

    await waitFor(() =>
      expect(screen.getByText("Password updated")).toBeInTheDocument(),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/auth/password/reset",
      expect.objectContaining({
        body: JSON.stringify({
          phoneNumber: "+919876543210",
          otp: "123456",
          newPassword: "new-strong-password",
        }),
      }),
    );
    expect(
      screen.getByRole("link", { name: /continue to sign in/i }),
    ).toHaveAttribute("href", "/auth/login");
  });

  it("shows recovery validation errors without sending a request", async () => {
    searchValues.set("phone", "+919876543210");
    const user = userEvent.setup();
    render(<ResetPasswordForm />);
    await user.type(screen.getByLabelText("Reset code"), "12");
    await user.type(screen.getByLabelText("New password"), "short");
    await user.click(screen.getByRole("button", { name: /update password/i }));

    expect(
      await screen.findByText(/complete 6-digit verification code/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/at least 8 characters/i)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("prevents password reset when recovery context is missing", () => {
    render(<ResetPasswordForm />);
    expect(
      screen.getByRole("button", { name: /update password/i }),
    ).toBeDisabled();
    expect(
      screen.getByText(/missing a valid phone number/i),
    ).toBeInTheDocument();
  });

  it("reports an incorrect reset OTP and preserves the new password", async () => {
    searchValues.set("phone", "+919876543210");
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({
        code: "OTP_INVALID_OR_EXPIRED",
        message: "Invalid",
      }),
    });
    const user = userEvent.setup();
    render(<ResetPasswordForm />);
    await user.type(screen.getByLabelText("Reset code"), "000000");
    await user.type(
      screen.getByLabelText("New password"),
      "new-strong-password",
    );
    await user.click(screen.getByRole("button", { name: /update password/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "incorrect or has expired",
    );
    expect(screen.getByLabelText("New password")).toHaveValue(
      "new-strong-password",
    );
  });

  it("resends a reset code and announces the generic success response", async () => {
    searchValues.set("phone", "+919876543210");
    const user = userEvent.setup();
    render(<ResetPasswordForm />);
    await user.click(
      screen.getByRole("button", { name: /resend reset code/i }),
    );
    expect(await screen.findByRole("status")).toHaveTextContent(
      "if this account is eligible",
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/auth/password/forgot",
      expect.objectContaining({
        body: JSON.stringify({ phoneNumber: "+919876543210" }),
      }),
    );
  });

  // ---------------------------------------------------------------------------
  // End-to-end journeys spanning multiple screens
  // ---------------------------------------------------------------------------

  it("completes the applicant journey: register → OTP → login", async () => {
    const user = userEvent.setup();

    // 1. Register
    const registration = render(<RegisterForm />);
    await user.type(screen.getByLabelText("Full name"), "Applicant One");
    await user.type(screen.getByLabelText("Mobile number"), "9876543210");
    await user.type(screen.getByLabelText("Create password"), "strong-password");
    await user.click(screen.getByRole("button", { name: /create account/i }));
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith("/auth/verify-otp?phone=%2B919876543210&role=applicant"),
    );
    registration.unmount();

    // 2. Verify OTP (carrying the phone/role forwarded in the URL)
    searchValues.set("phone", "+919876543210");
    searchValues.set("role", "applicant");
    const otp = render(<OtpForm />);
    await user.type(screen.getByLabelText("Verification code"), "123456");
    await user.click(screen.getByRole("button", { name: /verify and continue/i }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/auth/login"));
    otp.unmount();
    searchValues.clear();

    // 3. Login
    render(<LoginForm />);
    await user.type(screen.getByLabelText("Registered mobile number"), "9876543210");
    await user.type(screen.getByLabelText("Password"), "strong-password");
    await user.click(screen.getByRole("button", { name: /sign in to applicant/i }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/applicant/dashboard"));
    expect(refresh).toHaveBeenCalled();
  });

  it("completes the inspector journey: register with department → OTP → login", async () => {
    const user = userEvent.setup();

    const registration = render(<RegisterForm inspector />);
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Department" }),
      "Maharashtra Pollution Control Board (MPCB)",
    );
    await user.type(screen.getByLabelText("Full name"), "Inspector One");
    await user.type(screen.getByLabelText("Mobile number"), "9876543211");
    await user.type(screen.getByLabelText("Create password"), "strong-password");
    await user.click(screen.getByRole("button", { name: /register inspector account/i }));
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith("/auth/verify-otp?phone=%2B919876543211&role=inspector"),
    );
    registration.unmount();

    searchValues.set("phone", "+919876543211");
    searchValues.set("role", "inspector");
    const otp = render(<OtpForm />);
    await user.type(screen.getByLabelText("Verification code"), "123456");
    await user.click(screen.getByRole("button", { name: /verify and continue/i }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/inspector/login"));
    otp.unmount();
    searchValues.clear();

    render(<LoginForm mode="inspector" />);
    await user.type(screen.getByLabelText("Registered mobile number"), "9876543211");
    await user.type(screen.getByLabelText("Password"), "strong-password");
    await user.click(screen.getByRole("button", { name: /sign in to inspector/i }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/"));
    expect(
      JSON.parse(fetchMock.mock.calls.at(-1)?.[1]?.body as string),
    ).toMatchObject({ expectedRole: "inspector" });
  });

  it("recovers a forgotten password: forgot → reset → login with the new password", async () => {
    const user = userEvent.setup();

    searchValues.set("mode", "applicant");
    const forgot = render(<ForgotPasswordForm />);
    await user.type(screen.getByLabelText("Registered mobile number"), "9876543210");
    await user.click(screen.getByRole("button", { name: /send reset code/i }));
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith("/auth/reset-password?phone=%2B919876543210&mode=applicant"),
    );
    forgot.unmount();

    searchValues.set("phone", "+919876543210");
    const reset = render(<ResetPasswordForm />);
    await user.type(screen.getByLabelText("Reset code"), "123456");
    await user.type(screen.getByLabelText("New password"), "brand-new-password");
    await user.click(screen.getByRole("button", { name: /update password/i }));
    await waitFor(() => expect(screen.getByText("Password updated")).toBeInTheDocument());
    reset.unmount();
    searchValues.clear();

    render(<LoginForm />);
    await user.type(screen.getByLabelText("Registered mobile number"), "9876543210");
    await user.type(screen.getByLabelText("Password"), "brand-new-password");
    await user.click(screen.getByRole("button", { name: /sign in to applicant/i }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/applicant/dashboard"));
    expect(
      JSON.parse(fetchMock.mock.calls.at(-1)?.[1]?.body as string),
    ).toMatchObject({ password: "brand-new-password" });
  });

  // ---------------------------------------------------------------------------
  // Additional edge cases
  // ---------------------------------------------------------------------------

  it("rejects a 10-digit number that does not start with 6-9 without calling the API", async () => {
    const user = userEvent.setup();
    render(<LoginForm />);
    await user.type(screen.getByLabelText("Registered mobile number"), "3646374737");
    await user.type(screen.getByLabelText("Password"), "strong-password");
    await user.click(screen.getByRole("button", { name: /sign in to applicant/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Enter a 10-digit Indian mobile number starting with 6, 7, 8 or 9.",
    );
    expect(fetchMock).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it("surfaces a server outage as a temporary-unavailability message on login", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ message: "Server error" }),
    });
    const user = userEvent.setup();
    render(<LoginForm />);
    await user.type(screen.getByLabelText("Registered mobile number"), "9876543210");
    await user.type(screen.getByLabelText("Password"), "strong-password");
    await user.click(screen.getByRole("button", { name: /sign in to applicant/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("temporarily unavailable");
    expect(push).not.toHaveBeenCalled();
  });

  it("surfaces a network failure as a connection message on login", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    const user = userEvent.setup();
    render(<LoginForm />);
    await user.type(screen.getByLabelText("Registered mobile number"), "9876543210");
    await user.type(screen.getByLabelText("Password"), "strong-password");
    await user.click(screen.getByRole("button", { name: /sign in to applicant/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("could not reach the service");
    expect(push).not.toHaveBeenCalled();
  });

  it("reports rate limiting on login", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: async () => ({ message: "Too many" }),
    });
    const user = userEvent.setup();
    render(<LoginForm />);
    await user.type(screen.getByLabelText("Registered mobile number"), "9876543210");
    await user.type(screen.getByLabelText("Password"), "strong-password");
    await user.click(screen.getByRole("button", { name: /sign in to applicant/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Too many attempts");
  });

  it("guides an unverified account to complete verification", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({ code: "ACCOUNT_INACTIVE", message: "Inactive" }),
    });
    const user = userEvent.setup();
    render(<LoginForm />);
    await user.type(screen.getByLabelText("Registered mobile number"), "9876543210");
    await user.type(screen.getByLabelText("Password"), "strong-password");
    await user.click(screen.getByRole("button", { name: /sign in to applicant/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("not active");
  });

  it("toggles password visibility on login", async () => {
    const user = userEvent.setup();
    render(<LoginForm />);
    const password = screen.getByLabelText("Password");
    expect(password).toHaveAttribute("type", "password");
    await user.click(screen.getByRole("button", { name: /show password/i }));
    expect(password).toHaveAttribute("type", "text");
    await user.click(screen.getByRole("button", { name: /hide password/i }));
    expect(password).toHaveAttribute("type", "password");
  });

  it("reports an incorrect OTP and keeps the user on the verification screen", async () => {
    searchValues.set("phone", "+919876543210");
    searchValues.set("role", "applicant");
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ code: "OTP_INVALID_OR_EXPIRED", message: "Invalid" }),
    });
    const user = userEvent.setup();
    render(<OtpForm />);
    await user.type(screen.getByLabelText("Verification code"), "000000");
    await user.click(screen.getByRole("button", { name: /verify and continue/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("incorrect or has expired");
    expect(push).not.toHaveBeenCalled();
  });

  it("aborts a hung login request and shows a timeout message", async () => {
    vi.useFakeTimers();
    try {
      // A request that never resolves until its abort signal fires.
      fetchMock.mockImplementationOnce(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener("abort", () =>
              reject(new DOMException("Aborted", "AbortError")),
            );
          }),
      );
      render(<LoginForm />);
      fireEvent.change(screen.getByLabelText("Registered mobile number"), {
        target: { value: "9876543210" },
      });
      fireEvent.change(screen.getByLabelText("Password"), {
        target: { value: "strong-password" },
      });
      fireEvent.submit(
        screen
          .getByRole("button", { name: /sign in to applicant/i })
          .closest("form")!,
      );

      // Advance past the request timeout to trigger the abort.
      await vi.advanceTimersByTimeAsync(20_000);

      expect(screen.getByRole("alert")).toHaveTextContent("timed out");
      expect(push).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps registration on the form when the service errors", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ message: "Server error" }),
    });
    const user = userEvent.setup();
    render(<RegisterForm />);
    await user.type(screen.getByLabelText("Full name"), "Applicant One");
    await user.type(screen.getByLabelText("Mobile number"), "9876543210");
    await user.type(screen.getByLabelText("Create password"), "strong-password");
    await user.click(screen.getByRole("button", { name: /create account/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("temporarily unavailable");
    expect(push).not.toHaveBeenCalled();
  });
});
