"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  loginFormSchema,
  type LoginFormValues,
} from "@/features/auth/auth-form-schemas";
import { FieldError, FormStatus } from "@/features/auth/form-message";
import { sessionQueryKey } from "@/features/auth/session-panel";
import { useLanguage } from "@/components/providers/language-provider";
import {
  authRequest,
  getAuthErrorMessage,
  type AuthUser,
  type UserRole,
} from "@/lib/auth-api";

type LoginMode = "applicant" | "inspector";
const expectedRoles: Record<LoginMode, UserRole> = {
  applicant: "applicant",
  inspector: "inspector",
};
const postLoginRoutes: Record<LoginMode, string> = {
  applicant: "/applicant/dashboard",
  inspector: "/inspector/dashboard",
};

const inspectorWorkspaceRoutes = [
  "/inspector/dashboard",
  "/inspector/applications",
  "/inspector/inspections",
  "/inspector/clarifications",
  "/inspector/decisions",
  "/inspector/reports",
] as const;

export function getPostLoginRoute(
  mode: LoginMode,
  requestedPath: string | null,
): string {
  if (
    !requestedPath ||
    !requestedPath.startsWith("/") ||
    requestedPath.startsWith("//") ||
    requestedPath.includes("\\")
  ) {
    return postLoginRoutes[mode];
  }

  const pathname = requestedPath.split(/[?#]/, 1)[0] ?? "";
  const allowed =
    mode === "applicant"
      ? pathname === "/applicant" || pathname.startsWith("/applicant/")
      : inspectorWorkspaceRoutes.some(
          (route) => pathname === route || pathname.startsWith(`${route}/`),
        );

  return allowed ? requestedPath : postLoginRoutes[mode];
}

export function LoginForm({ mode = "applicant" }: { mode?: LoginMode }) {
  const { t } = useLanguage();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: { phone: "", password: "", rememberMe: false },
    mode: "onChange",
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      const response = await authRequest<{ data: { user: AuthUser } }>(
        "/login",
        {
          phoneNumber: `+91${values.phone}`,
          password: values.password,
          rememberMe: values.rememberMe,
          expectedRole: expectedRoles[mode],
        },
      );
      queryClient.setQueryData(sessionQueryKey, response.data.user);
      const requestedPath = new URLSearchParams(window.location.search).get(
        "next",
      );
      router.push(getPostLoginRoute(mode, requestedPath));
      router.refresh();
    } catch (cause) {
      setServerError(getAuthErrorMessage(cause, "login"));
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-3">
      <FormStatus message={serverError} />
      <div className="space-y-1.5">
        <Label htmlFor="phone">{t("auth.mobile")}</Label>
        <div className="flex">
          <span
            className="flex h-12 items-center rounded-l-md border border-r-0 border-[#aeb7c4] bg-slate-50 px-3 text-sm text-slate-600"
            aria-hidden="true"
          >
            +91
          </span>
          <Input
            id="phone"
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            spellCheck={false}
            maxLength={10}
            placeholder="98765 43210"
            className="h-12 rounded-l-none border-[#aeb7c4] bg-white px-3 text-base focus-visible:border-[#315f9f] focus-visible:ring-[#315f9f]/25"
            aria-invalid={Boolean(errors.phone)}
            aria-describedby={errors.phone ? "phone-error" : "phone-hint"}
            {...register("phone")}
          />
        </div>
        <p id="phone-hint" className="text-xs text-muted-foreground">
          {t("auth.mobileHint")}
        </p>
        <FieldError id="phone-error" message={errors.phone?.message} />
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="password">
            {t(mode === "inspector" ? "auth.accessCode" : "auth.password")}
          </Label>
          {mode === "applicant" ? (
            <Link
              href={`/auth/forgot-password?mode=${mode}`}
              className="text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              {t("auth.forgotPassword")}
            </Link>
          ) : null}
        </div>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            placeholder={t(
              mode === "inspector" ? "auth.accessCodePlaceholder" : "auth.passwordPlaceholder",
            )}
            className="h-12 border-[#aeb7c4] bg-white pr-11 text-base focus-visible:border-[#315f9f] focus-visible:ring-[#315f9f]/25"
            aria-invalid={Boolean(errors.password)}
            aria-describedby={errors.password ? "password-error" : undefined}
            {...register("password")}
          />
          <button
            type="button"
            onClick={() => setShowPassword((value) => !value)}
            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-md text-slate-500 hover:text-slate-800 focus-visible:outline-3 focus-visible:outline-primary"
            aria-label={showPassword ? t("auth.hidePassword") : t("auth.showPassword")}
          >
            {showPassword ? (
              <EyeOff className="size-4" aria-hidden="true" />
            ) : (
              <Eye className="size-4" aria-hidden="true" />
            )}
          </button>
        </div>
        <FieldError id="password-error" message={errors.password?.message} />
      </div>
      <div className="flex min-h-11 items-center gap-3 text-sm text-slate-600">
        <Controller
          name="rememberMe"
          control={control}
          render={({ field }) => (
            <Checkbox
              id="remember"
              checked={field.value}
              onCheckedChange={field.onChange}
            />
          )}
        />
        <Label
          htmlFor="remember"
          className="cursor-pointer font-normal text-slate-600"
        >
          {t("auth.rememberDevice")}
        </Label>
      </div>
      <Button
        type="submit"
        size="lg"
        className="h-12 w-full justify-between rounded-md border-[#214d90] bg-[#315f9f] px-5 text-sm font-semibold shadow-[0_6px_14px_rgba(49,95,159,0.22)] transition-[background-color,border-color,box-shadow,transform] hover:border-[#173d78] hover:bg-[#254e88] hover:shadow-[0_8px_18px_rgba(49,95,159,0.28)] focus-visible:border-[#173d78] focus-visible:ring-4 focus-visible:ring-[#315f9f]/30 active:translate-y-px"
        disabled={isSubmitting}
        aria-busy={isSubmitting}
      >
        <span>{isSubmitting ? t("auth.signingIn") : t(mode === "applicant" ? "auth.signInApplicant" : "auth.signInInspector")}</span>
        <ArrowRight aria-hidden="true" />
      </Button>
      {mode === "applicant" && (
        <>
          <Separator />
          <p className="text-center text-sm text-slate-600">
            {t("auth.newApplicant")}{" "}
            <Link
              href="/auth/register"
              className="font-semibold text-[#315f9f] underline-offset-4 hover:underline"
            >
              {t("auth.createApplicant")}
            </Link>
          </p>
        </>
      )}
      {mode === "inspector" && (
        <>
          <Separator />
          <p className="text-center text-sm text-slate-600">
            {t("auth.inspectorProvisioned")}
          </p>
        </>
      )}
    </form>
  );
}
