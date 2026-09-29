"use client";

import {
  ArrowLeft,
  Building2,
  Check,
  ClipboardCheck,
  FileCheck2,
  ShieldCheck,
} from "lucide-react";

import Link from "next/link";

import { SiteHeader } from "@/components/layout/site-header";
import { RegisterForm } from "@/features/auth/register-form";
import { useLanguage } from "@/components/providers/language-provider";

type RegistrationMode = "applicant" | "inspector";

const content = {
  applicant: {
    eyebrow: "Applicant Registration",
    title: "Create Your Industrial Approval Account",
    description:
      "Set up one secure account to register your business, manage project documents and track departmental approvals.",
    formEyebrow: "New Applicant",
    formTitle: "Your Account Details",
    formDescription:
      "All fields are required. You will verify your mobile number in the next step.",
    formIcon: FileCheck2,
    steps: [
      {
        title: "Create your account",
        description:
          "Add your name, registered mobile number and a secure password.",
        icon: ShieldCheck,
      },
      {
        title: "Verify your mobile",
        description: "Confirm your number with the one-time verification code.",
        icon: Check,
      },
      {
        title: "Start your project",
        description:
          "Add your business details and begin the guided approval journey.",
        icon: Building2,
      },
    ],
  },
  inspector: {
    eyebrow: "Inspector Registration",
    title: "Create Your Inspector Account",
    description:
      "Set up a secure department account to review assigned applications and respond to applicant submissions.",
    formEyebrow: "New Inspector",
    formTitle: "Your Account Details",
    formDescription:
      "All fields are required. You will verify your mobile number in the next step.",
    formIcon: ClipboardCheck,
    steps: [
      {
        title: "Create your account",
        description:
          "Add your name, department, registered mobile number and password.",
        icon: ShieldCheck,
      },
      {
        title: "Verify your mobile",
        description: "Confirm your number with the one-time verification code.",
        icon: Check,
      },
      {
        title: "Open your workspace",
        description:
          "Review applications assigned to your department after verification.",
        icon: ClipboardCheck,
      },
    ],
  },
} as const satisfies Record<RegistrationMode, object>;

export function RegistrationExperience({ mode }: { mode: RegistrationMode }) {
  const { t, text } = useLanguage();
  const page = content[mode];
  const FormIcon = page.formIcon;
  const stepKeys = mode === "applicant"
    ? ["registration.createAccount", "registration.verifyMobile", "registration.startProject"] as const
    : ["registration.createAccount", "registration.verifyMobile", "registration.openWorkspace"] as const;
  const descriptionKeys = mode === "applicant"
    ? ["registration.addApplicantDetails", "registration.confirmNumber", "registration.startProjectDescription"] as const
    : ["registration.addInspectorDetails", "registration.confirmNumber", "registration.openWorkspaceDescription"] as const;

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <a
        href="#registration-form"
        className="sr-only z-50 bg-card p-3 text-foreground focus:fixed focus:top-4 focus:left-4 focus:not-sr-only"
      >
        {t("registration.skip")}
      </a>
      <SiteHeader actionLabel={t("header.changeWorkspace")} />
      <main className="mx-auto grid w-full max-w-7xl gap-8 px-5 py-8 sm:px-8 sm:py-12 lg:grid-cols-[minmax(0,0.9fr)_minmax(30rem,1.1fr)] lg:items-start lg:gap-14 lg:px-10 lg:py-16">
        <section
          className="lg:sticky lg:top-10"
          aria-labelledby="registration-heading"
        >
          <Link
            href="/"
            className="inline-flex min-h-11 items-center gap-2 rounded-sm text-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            {text("Back to Workspaces")}
          </Link>
          <p className="mt-7 text-sm font-semibold text-primary">
            {t(mode === "applicant" ? "registration.applicantEyebrow" : "registration.inspectorEyebrow")}
          </p>
          <h1
            id="registration-heading"
            className="mt-3 max-w-xl text-pretty text-4xl leading-[1.08] font-semibold tracking-[-0.035em] text-foreground sm:text-5xl"
          >
            {t(mode === "applicant" ? "registration.applicantTitle" : "registration.inspectorTitle")}
          </h1>
          <p className="mt-5 max-w-xl text-pretty text-base leading-7 text-muted-foreground sm:text-lg">
            {t(mode === "applicant" ? "registration.applicantDescription" : "registration.inspectorDescription")}
          </p>

          <ol
            className="mt-7 grid max-w-xl grid-cols-3 gap-2 lg:mt-9 lg:block lg:space-y-1"
            aria-label={t("registration.process")}
          >
            {page.steps.map((step, index) => {
              const Icon = step.icon;
              return (
                <li
                  key={step.title}
                  className="relative flex min-w-0 flex-col items-center gap-2 rounded-md border border-border bg-card p-3 text-center lg:grid lg:grid-cols-[2.75rem_1fr] lg:gap-4 lg:border-0 lg:bg-transparent lg:p-0 lg:pb-6 lg:text-left lg:last:pb-0"
                >
                  {index < page.steps.length - 1 && (
                    <span
                      className="absolute top-11 bottom-0 left-[1.35rem] hidden w-px bg-slate-200 lg:block"
                      aria-hidden="true"
                    />
                  )}
                  <span className="relative z-10 grid size-9 place-items-center rounded-full bg-blue-50 text-primary lg:size-11 lg:border lg:border-border lg:bg-card">
                    <Icon className="size-4 lg:size-5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 lg:pt-1">
                    <h2 className="text-xs leading-4 font-semibold text-foreground sm:text-sm lg:text-base lg:leading-normal">
                      {index + 1}. {t(stepKeys[index])}
                    </h2>
                    <p className="mt-1 hidden text-sm leading-6 text-muted-foreground lg:block">
                      {t(descriptionKeys[index])}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>

        <section
          id="registration-form"
          aria-labelledby="form-heading"
          className="border border-border bg-card shadow-[0_18px_55px_rgba(20,43,69,0.08)]"
        >
          <header className="border-b border-border px-5 py-5 sm:px-8 sm:py-7">
            <div className="flex items-start gap-4">
              <span className="grid size-11 shrink-0 place-items-center rounded-md bg-blue-50 text-primary">
                <FormIcon className="size-5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-semibold text-primary">
                  {t(mode === "applicant" ? "registration.newApplicant" : "registration.newInspector")}
                </p>
                <h2
                  id="form-heading"
                  className="mt-1 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl"
                >
                  {t("registration.accountDetails")}
                </h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {t("registration.requiredAndVerify")}
                </p>
              </div>
            </div>
          </header>
          <div className="px-5 py-5 sm:px-8 sm:py-7">
            <RegisterForm inspector={mode === "inspector"} />
          </div>
        </section>
      </main>
    </div>
  );
}
