"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { forgotPasswordFormSchema, type ForgotPasswordFormValues } from "@/features/auth/auth-form-schemas";
import { FieldError, FormStatus } from "@/features/auth/form-message";
import { authRequest, getAuthErrorMessage } from "@/lib/auth-api";
import { useLanguage } from "@/components/providers/language-provider";

export function ForgotPasswordForm() {
  const { t } = useLanguage();
  const router = useRouter();
  const mode = useSearchParams().get("mode") ?? "applicant";
  const [serverError, setServerError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<ForgotPasswordFormValues>({ resolver: zodResolver(forgotPasswordFormSchema), defaultValues: { phone: "" }, mode: "onChange" });
  const onSubmit = handleSubmit(async ({ phone }) => {
    setServerError(null);
    const phoneNumber = `+91${phone}`;
    try {
      await authRequest("/password/forgot", { phoneNumber });
      router.push(`/auth/reset-password?phone=${encodeURIComponent(phoneNumber)}&mode=${encodeURIComponent(mode)}`);
    } catch (cause) {
      setServerError(getAuthErrorMessage(cause, "forgotPassword"));
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <p className="text-sm leading-6 text-muted-foreground">{t("auth.forgotDescription")}</p>
      <FormStatus message={serverError} />
      <div className="space-y-1.5">
        <Label htmlFor="recovery-phone">{t("auth.mobile")}</Label>
        <div className="flex"><span className="flex h-11 items-center rounded-l-md border border-r-0 border-input bg-muted px-3 text-sm text-muted-foreground" aria-hidden="true">+91</span><Input id="recovery-phone" type="tel" inputMode="numeric" autoComplete="tel-national" maxLength={10} className="h-11 rounded-l-none bg-card" aria-invalid={Boolean(errors.phone)} aria-describedby={errors.phone ? "recovery-phone-error" : undefined} {...register("phone")} /></div>
        <FieldError id="recovery-phone-error" message={errors.phone?.message} />
      </div>
      <Button type="submit" size="lg" className="h-11 w-full" disabled={isSubmitting} aria-busy={isSubmitting}>{isSubmitting ? t("auth.sendingCode") : t("auth.sendResetCode")} <ArrowRight aria-hidden="true" /></Button>
      <p className="text-center text-sm"><Link href={mode === "inspector" ? "/inspector/login" : "/auth/login"} className="font-semibold text-primary underline-offset-4 hover:underline">{t("auth.backToSignIn")}</Link></p>
    </form>
  );
}
