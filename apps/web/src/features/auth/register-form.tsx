"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  applicantRegisterFormSchema,
  inspectorRegisterFormSchema,
  type RegisterFormValues,
} from "@/features/auth/auth-form-schemas";
import { allInspectorDepartments } from "@/features/auth/auth-options";
import { FieldError, FormStatus } from "@/features/auth/form-message";
import { authRequest, getAuthErrorMessage } from "@/lib/auth-api";
import { useLanguage } from "@/components/providers/language-provider";

const nativeSelectClass =
  "h-11 w-full rounded-md border border-input bg-white px-3 text-base text-[#18263d] outline-none focus-visible:border-[#315f9f] focus-visible:ring-3 focus-visible:ring-[#315f9f]/25 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20";

export function RegisterForm({ inspector = false }: { inspector?: boolean }) {
  const { t } = useLanguage();
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(
      inspector ? inspectorRegisterFormSchema : applicantRegisterFormSchema,
    ),
    defaultValues: {
      name: "",
      phone: "",
      password: "",
      department: "",
      industry: "steel",
    },
    mode: "onChange",
  });
  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    const phoneNumber = `+91${values.phone}`;
    try {
      await authRequest(
        "/register",
        inspector
          ? {
              name: values.name.trim(),
              phoneNumber,
              password: values.password,
              role: "inspector",
              departmentKey: values.department,
            }
          : {
              name: values.name.trim(),
              phoneNumber,
              password: values.password,
              role: "applicant",
              industry: values.industry,
            },
      );
      router.push(
        `/auth/verify-otp?phone=${encodeURIComponent(phoneNumber)}&role=${inspector ? "inspector" : "applicant"}`,
      );
    } catch (cause) {
      setServerError(getAuthErrorMessage(cause, "register"));
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-3.5">
      <FormStatus message={serverError} />
      {inspector && (
        <div className="space-y-1.5">
          <Label htmlFor="department">{t("auth.department")}</Label>
          <Controller
            name="department"
            control={control}
            render={({ field }) => (
              <select
                id="department"
                className={nativeSelectClass}
                value={field.value}
                onChange={(event) => field.onChange(event.target.value)}
                onBlur={field.onBlur}
                aria-invalid={Boolean(errors.department)}
                aria-describedby={
                  errors.department ? "department-error" : "department-hint"
                }
              >
                <option value="" disabled>
                  {t("auth.selectDepartment")}
                </option>
                {allInspectorDepartments.map((department) => (
                  <option key={department.value} value={department.value}>
                    {department.label}
                  </option>
                ))}
              </select>
            )}
          />
          <p id="department-hint" className="text-xs text-muted-foreground">
            {t("auth.departmentHint")}
          </p>
          <FieldError
            id="department-error"
            message={errors.department?.message}
          />
        </div>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="name">{t("auth.fullName")}</Label>
        <Input
          id="name"
          autoComplete="name"
          maxLength={150}
          className="h-11 bg-white"
          placeholder={t("auth.fullNamePlaceholder")}
          aria-invalid={Boolean(errors.name)}
          aria-describedby={errors.name ? "name-error" : undefined}
          {...register("name")}
        />
        <FieldError id="name-error" message={errors.name?.message} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="phone">{t("auth.mobileNumber")}</Label>
        <div className="flex">
          <span
            className="flex h-11 items-center rounded-l-md border border-r-0 border-input bg-slate-50 px-3 text-sm text-slate-600"
            aria-hidden="true"
          >
            +91
          </span>
          <Input
            id="phone"
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            maxLength={10}
            className="h-11 rounded-l-none bg-white"
            placeholder="98765 43210"
            aria-invalid={Boolean(errors.phone)}
            aria-describedby={errors.phone ? "register-phone-error" : undefined}
            {...register("phone")}
          />
        </div>
        <FieldError id="register-phone-error" message={errors.phone?.message} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="new-password">{t("auth.createPassword")}</Label>
        <Input
          id="new-password"
          type="password"
          autoComplete="new-password"
          maxLength={128}
          className="h-11 bg-white"
          aria-invalid={Boolean(errors.password)}
          aria-describedby={
            errors.password ? "register-password-error" : "password-hint"
          }
          {...register("password")}
        />
        <p id="password-hint" className="text-xs text-muted-foreground">
          {t("auth.passwordHint")}
        </p>
        <FieldError
          id="register-password-error"
          message={errors.password?.message}
        />
      </div>
      <Button
        type="submit"
        size="lg"
        className="h-11 w-full"
        disabled={isSubmitting}
        aria-busy={isSubmitting}
      >
        {isSubmitting
          ? t("auth.creatingAccount")
          : inspector
            ? t("auth.registerInspector")
            : t("auth.createAndVerify")}{" "}
        <ArrowRight aria-hidden="true" />
      </Button>
      <Separator />
      <p className="text-center text-sm text-slate-600">
        {t("auth.alreadyRegistered")}{" "}
        <Link
          href={inspector ? "/inspector/login" : "/auth/login"}
          className="font-semibold text-primary underline-offset-4 hover:underline"
        >
          {t("auth.signIn")}
        </Link>
      </p>
    </form>
  );
}
