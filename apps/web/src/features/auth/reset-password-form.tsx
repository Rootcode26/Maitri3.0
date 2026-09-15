"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Eye, EyeOff, RotateCcw } from "lucide-react";
import { REGEXP_ONLY_DIGITS } from "input-otp";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";

import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import { resetPasswordFormSchema, type ResetPasswordFormValues } from "@/features/auth/auth-form-schemas";
import { FieldError, FormStatus } from "@/features/auth/form-message";
import { authRequest, getAuthErrorMessage } from "@/lib/auth-api";

function loginPath(mode: string | null) { return mode === "inspector" ? "/inspector/login" : "/auth/login"; }

export function ResetPasswordForm() {
  const params = useSearchParams();
  const phoneNumber = params.get("phone") ?? "";
  const returnPath = loginPath(params.get("mode"));
  const validContext = /^\+91[6-9]\d{9}$/.test(phoneNumber);
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [complete, setComplete] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const { register, control, handleSubmit, formState: { errors, isSubmitting } } = useForm<ResetPasswordFormValues>({ resolver: zodResolver(resetPasswordFormSchema), defaultValues: { otp: "", newPassword: "" }, mode: "onChange" });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    if (!validContext) return setServerError("The recovery link is incomplete. Request a new reset code.");
    try {
      await authRequest("/password/reset", { phoneNumber, otp: values.otp, newPassword: values.newPassword });
      setComplete(true);
    } catch (cause) { setServerError(getAuthErrorMessage(cause, "resetPassword")); }
  });

  async function resendCode() {
    setServerError(null); setNotice(null);
    if (!validContext) return setServerError("The recovery link is incomplete. Request a new reset code.");
    setIsResending(true);
    try { await authRequest("/password/forgot", { phoneNumber }); setNotice("A new reset code has been sent if this account is eligible."); }
    catch (cause) { setServerError(getAuthErrorMessage(cause, "forgotPassword")); }
    finally { setIsResending(false); }
  }

  if (complete) return <div className="space-y-4 text-center" role="status"><CheckCircle2 className="mx-auto size-10 text-emerald-600" aria-hidden="true" /><div><p className="font-semibold text-[#142b45]">Password updated</p><p className="mt-1 text-sm text-slate-600">Your existing sessions have been signed out.</p></div><Link href={returnPath} className={buttonVariants({ className: "h-11 w-full" })}>Continue to sign in</Link></div>;

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <FormStatus message={serverError} /><FormStatus message={notice} tone="success" />
      <div className="space-y-2">
        <Label htmlFor="reset-otp">Reset code</Label>
        <Controller name="otp" control={control} render={({ field }) => <InputOTP id="reset-otp" maxLength={6} pattern={REGEXP_ONLY_DIGITS} autoComplete="one-time-code" value={field.value} onChange={field.onChange} aria-invalid={Boolean(errors.otp)} aria-describedby={errors.otp ? "reset-otp-error" : undefined} containerClassName="w-full justify-center"><InputOTPGroup>{[0, 1, 2].map((index) => <InputOTPSlot key={index} index={index} className="size-11 bg-white text-lg font-semibold" />)}</InputOTPGroup><InputOTPSeparator className="mx-1 text-slate-400" /><InputOTPGroup>{[3, 4, 5].map((index) => <InputOTPSlot key={index} index={index} className="size-11 bg-white text-lg font-semibold" />)}</InputOTPGroup></InputOTP>} />
        <FieldError id="reset-otp-error" message={errors.otp?.message} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="new-password">New password</Label>
        <div className="relative"><Input id="new-password" type={showPassword ? "text" : "password"} autoComplete="new-password" maxLength={128} className="h-11 bg-white pr-11" aria-invalid={Boolean(errors.newPassword)} aria-describedby={errors.newPassword ? "new-password-error" : "new-password-hint"} {...register("newPassword")} /><button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate-500 focus-visible:outline-3 focus-visible:outline-primary" aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}</button></div>
        <p id="new-password-hint" className="text-xs text-muted-foreground">Use between 8 and 128 characters.</p>
        <FieldError id="new-password-error" message={errors.newPassword?.message} />
      </div>
      <Button type="submit" size="lg" className="h-11 w-full" disabled={isSubmitting || isResending || !validContext} aria-busy={isSubmitting}>{isSubmitting ? "Updating password…" : "Update password"}</Button>
      <Button type="button" variant="outline" className="h-11 w-full" onClick={resendCode} disabled={isSubmitting || isResending || !validContext} aria-busy={isResending}><RotateCcw aria-hidden="true" /> {isResending ? "Sending…" : "Resend reset code"}</Button>
      {!validContext && <p role="alert" className="text-sm text-red-700">The recovery link is missing a valid phone number. Request a new code.</p>}
    </form>
  );
}
