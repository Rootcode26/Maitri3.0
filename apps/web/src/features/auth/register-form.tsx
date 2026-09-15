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
import {
  allInspectorDepartments,
  industryLabels,
} from "@/features/auth/auth-options";
import { FieldError, FormStatus } from "@/features/auth/form-message";
import { authRequest, getAuthErrorMessage } from "@/lib/auth-api";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function RegisterForm({ inspector = false }: { inspector?: boolean }) {
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
          <Label htmlFor="department">Department</Label>
          <Controller
            name="department"
            control={control}
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger
                  id="department"
                  className="h-11 w-full bg-white"
                  aria-invalid={Boolean(errors.department)}
                  aria-describedby={
                    errors.department ? "department-error" : "department-hint"
                  }
                >
                  <SelectValue placeholder="Select your department" />
                </SelectTrigger>
                <SelectContent
                  side="bottom"
                  align="start"
                  alignItemWithTrigger={false}
                  className="max-h-64 max-w-[min(34rem,calc(100vw-2rem))] text-sm"
                >
                  {allInspectorDepartments.map((department) => (
                    <SelectItem key={department.value} value={department.value}>
                      {department.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          <p id="department-hint" className="text-xs text-muted-foreground">
            Select the government department associated with this inspector
            account.
          </p>
          <FieldError
            id="department-error"
            message={errors.department?.message}
          />
        </div>
      )}
      {!inspector && (
        <div className="space-y-1.5">
          <Label htmlFor="register-industry">Industry</Label>
          <Controller
            name="industry"
            control={control}
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger
                  id="register-industry"
                  className="h-11 w-full bg-white"
                  aria-invalid={Boolean(errors.industry)}
                  aria-describedby={
                    errors.industry ? "industry-error" : "industry-hint"
                  }
                >
                  <SelectValue placeholder="Select your industry" />
                </SelectTrigger>
                <SelectContent
                  side="bottom"
                  align="start"
                  alignItemWithTrigger={false}
                  className="text-sm"
                >
                  {Object.entries(industryLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          <p className="text-xs text-muted-foreground">
            Select the industry for your approval application.
          </p>
          <FieldError id="industry-error" message={errors.industry?.message} />
        </div>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="name">Full name</Label>
        <Input
          id="name"
          autoComplete="name"
          maxLength={150}
          className="h-11 bg-white"
          placeholder="Enter your full name"
          aria-invalid={Boolean(errors.name)}
          aria-describedby={errors.name ? "name-error" : undefined}
          {...register("name")}
        />
        <FieldError id="name-error" message={errors.name?.message} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="phone">Mobile number</Label>
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
        <Label htmlFor="new-password">Create password</Label>
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
          Use at least 8 characters. Password managers and paste are supported.
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
          ? "Creating account…"
          : inspector
            ? "Register inspector account"
            : "Create account and verify mobile"}{" "}
        <ArrowRight aria-hidden="true" />
      </Button>
      <Separator />
      <p className="text-center text-sm text-slate-600">
        Already registered?{" "}
        <Link
          href={inspector ? "/inspector/login" : "/auth/login"}
          className="font-semibold text-primary underline-offset-4 hover:underline"
        >
          Sign in
        </Link>
      </p>
    </form>
  );
}
