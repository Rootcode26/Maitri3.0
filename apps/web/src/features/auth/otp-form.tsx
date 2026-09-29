"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight, RotateCcw } from "lucide-react";
import { REGEXP_ONLY_DIGITS } from "input-otp";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { otpFormSchema, type OtpFormValues } from "@/features/auth/auth-form-schemas";
import { FieldError, FormStatus } from "@/features/auth/form-message";
import { sessionQueryKey } from "@/features/auth/session-panel";
import { authRequest, getAuthErrorMessage, type AuthUser } from "@/lib/auth-api";
import { useLanguage } from "@/components/providers/language-provider";

function maskedPhone(phone: string | null) {
  if (!phone || !/^\+91[6-9]\d{9}$/.test(phone)) return "your registered mobile number";
  return `${phone.slice(0, 3)} ••••• ${phone.slice(-4)}`;
}

export function OtpForm() {
  const { t } = useLanguage();
  const router = useRouter();
  const queryClient = useQueryClient();
  const params = useSearchParams();
  const phoneNumber = params.get("phone") ?? "";
  const role = params.get("role") === "inspector" ? "inspector" : "applicant";
  const [serverError, setServerError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isResending, setIsResending] = useState(false);
  const { control, handleSubmit, formState: { errors, isSubmitting } } = useForm<OtpFormValues>({ resolver: zodResolver(otpFormSchema), defaultValues: { otp: "" }, mode: "onChange" });

  const onSubmit = handleSubmit(async ({ otp }) => {
    setServerError(null);
    setNotice(null);
    if (!/^\+91[6-9]\d{9}$/.test(phoneNumber)) return setServerError(t("auth.verificationMissing"));
    try {
      const response = await authRequest<{ data: { user: AuthUser } }>("/otp/verify", { phoneNumber, otp });
      queryClient.setQueryData(sessionQueryKey, response.data.user);
      router.push(role === "inspector" ? "/inspector/dashboard" : "/applicant/dashboard");
      router.refresh();
    } catch (cause) {
      setServerError(getAuthErrorMessage(cause, "verifyOtp"));
    }
  });

  async function resendOtp() {
    setServerError(null);
    setNotice(null);
    if (!/^\+91[6-9]\d{9}$/.test(phoneNumber)) return setServerError(t("auth.verificationMissing"));
    setIsResending(true);
    try {
      await authRequest("/otp/resend", { phoneNumber });
      setNotice(t("auth.newCodeSent"));
    } catch (cause) {
      setServerError(getAuthErrorMessage(cause, "resendOtp"));
    } finally {
      setIsResending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-3">
      <p className="text-sm leading-6 text-muted-foreground">{t("auth.codeSent", { phone: "" })} <strong className="font-semibold text-foreground">{maskedPhone(phoneNumber)}</strong></p>
      <FormStatus message={serverError} /><FormStatus message={notice} tone="success" />
      <div className="space-y-2">
        <Label htmlFor="otp">{t("auth.verificationCode")}</Label>
        <Controller name="otp" control={control} render={({ field }) => (
          <InputOTP id="otp" maxLength={6} pattern={REGEXP_ONLY_DIGITS} autoComplete="one-time-code" value={field.value} onChange={field.onChange} aria-invalid={Boolean(errors.otp)} aria-describedby={errors.otp ? "otp-error" : "otp-hint"} containerClassName="w-full justify-center py-1">
            <InputOTPGroup>{[0, 1, 2].map((index) => <InputOTPSlot key={index} index={index} className="size-11 bg-card text-lg font-semibold tabular-nums sm:size-12 sm:text-xl" />)}</InputOTPGroup>
            <InputOTPSeparator className="mx-1 text-muted-foreground" />
            <InputOTPGroup>{[3, 4, 5].map((index) => <InputOTPSlot key={index} index={index} className="size-11 bg-card text-lg font-semibold tabular-nums sm:size-12 sm:text-xl" />)}</InputOTPGroup>
          </InputOTP>
        )} />
        <p id="otp-hint" className="text-center text-xs text-muted-foreground">{t("auth.codeExpires")}</p>
        <FieldError id="otp-error" message={errors.otp?.message} />
      </div>
      <Button type="submit" size="lg" className="h-11 w-full" disabled={isSubmitting || isResending} aria-busy={isSubmitting}>{isSubmitting ? t("auth.verifying") : t("auth.verifyContinue")} <ArrowRight aria-hidden="true" /></Button>
      <Button type="button" variant="outline" size="lg" className="h-11 w-full" onClick={resendOtp} disabled={isSubmitting || isResending} aria-busy={isResending}><RotateCcw aria-hidden="true" /> {isResending ? t("auth.sendingCode") : t("auth.resendCode")}</Button>
      <Separator />
      <p className="text-center text-sm text-muted-foreground">{t("auth.wrongNumber")} <Link href={role === "inspector" ? "/inspector/register" : "/auth/register"} className="font-semibold text-primary underline-offset-4 hover:underline">{t("auth.goBack")}</Link></p>
    </form>
  );
}
