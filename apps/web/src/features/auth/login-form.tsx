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
import {
  authRequest,
  getAuthErrorMessage,
  type AuthUser,
  type UserRole,
} from "@/lib/auth-api";

type LoginMode = "applicant" | "inspector";
const submitLabels: Record<LoginMode, string> = {
  applicant: "Sign In to Applicant Workspace",
  inspector: "Sign In to Inspector Workspace",
};
const expectedRoles: Record<LoginMode, UserRole> = {
  applicant: "applicant",
  inspector: "inspector",
};
const postLoginRoutes: Record<LoginMode, string> = {
  applicant: "/applicant/dashboard",
  inspector: "/inspector/dashboard",
};

export function LoginForm({ mode = "applicant" }: { mode?: LoginMode }) {
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
      router.push(postLoginRoutes[mode]);
      router.refresh();
    } catch (cause) {
      setServerError(getAuthErrorMessage(cause, "login"));
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-3">
      <FormStatus message={serverError} />
      <div className="space-y-1.5">
        <Label htmlFor="phone">Registered mobile number</Label>
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
          10-digit Indian mobile number, starting with 6, 7, 8 or 9.
        </p>
        <FieldError id="phone-error" message={errors.phone?.message} />
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="password">Password</Label>
          <Link
            href={`/auth/forgot-password?mode=${mode}`}
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            Forgot password?
          </Link>
        </div>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            placeholder="Enter your password…"
            className="h-12 border-[#aeb7c4] bg-white pr-11 text-base focus-visible:border-[#315f9f] focus-visible:ring-[#315f9f]/25"
            aria-invalid={Boolean(errors.password)}
            aria-describedby={errors.password ? "password-error" : undefined}
            {...register("password")}
          />
          <button
            type="button"
            onClick={() => setShowPassword((value) => !value)}
            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-md text-slate-500 hover:text-slate-800 focus-visible:outline-3 focus-visible:outline-primary"
            aria-label={showPassword ? "Hide password" : "Show password"}
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
          Remember this device for 30 days
        </Label>
      </div>
      <Button
        type="submit"
        size="lg"
        className="h-12 w-full justify-between rounded-md border-[#214d90] bg-[#315f9f] px-5 text-sm font-semibold shadow-[0_6px_14px_rgba(49,95,159,0.22)] transition-[background-color,border-color,box-shadow,transform] hover:border-[#173d78] hover:bg-[#254e88] hover:shadow-[0_8px_18px_rgba(49,95,159,0.28)] focus-visible:border-[#173d78] focus-visible:ring-4 focus-visible:ring-[#315f9f]/30 active:translate-y-px"
        disabled={isSubmitting}
        aria-busy={isSubmitting}
      >
        <span>{isSubmitting ? "Signing in…" : submitLabels[mode]}</span>
        <ArrowRight aria-hidden="true" />
      </Button>
      {mode === "applicant" && (
        <>
          <Separator />
          <p className="text-center text-sm text-slate-600">
            New applicant?{" "}
            <Link
              href="/auth/register"
              className="font-semibold text-[#315f9f] underline-offset-4 hover:underline"
            >
              Create an Account
            </Link>
          </p>
        </>
      )}
      {mode === "inspector" && (
        <>
          <Separator />
          <p className="text-center text-sm text-slate-600">
            New inspector?{" "}
            <Link
              href="/inspector/register"
              className="font-semibold text-[#315f9f] underline-offset-4 hover:underline"
            >
              Create an Inspector Account
            </Link>
          </p>
        </>
      )}
    </form>
  );
}
