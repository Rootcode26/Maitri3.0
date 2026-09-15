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
  const page = content[mode];
  const FormIcon = page.formIcon;

  return (
    <div className="min-h-dvh bg-background text-[#142b45]">
      <a
        href="#registration-form"
        className="sr-only z-50 bg-white p-3 text-[#142b45] focus:fixed focus:top-4 focus:left-4 focus:not-sr-only"
      >
        Skip to registration form
      </a>
      <SiteHeader actionLabel="Change workspace" />
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
            Back to Workspaces
          </Link>
          <p className="mt-7 text-sm font-semibold text-primary">
            {page.eyebrow}
          </p>
          <h1
            id="registration-heading"
            className="mt-3 max-w-xl text-pretty text-4xl leading-[1.08] font-semibold tracking-[-0.035em] text-[#142b45] sm:text-5xl"
          >
            {page.title}
          </h1>
          <p className="mt-5 max-w-xl text-pretty text-base leading-7 text-slate-600 sm:text-lg">
            {page.description}
          </p>

          <ol
            className="mt-9 max-w-xl space-y-1"
            aria-label="Registration process"
          >
            {page.steps.map((step, index) => {
              const Icon = step.icon;
              return (
                <li
                  key={step.title}
                  className="relative grid grid-cols-[2.75rem_1fr] gap-4 pb-6 last:pb-0"
                >
                  {index < page.steps.length - 1 && (
                    <span
                      className="absolute top-11 bottom-0 left-[1.35rem] w-px bg-slate-200"
                      aria-hidden="true"
                    />
                  )}
                  <span className="relative z-10 grid size-11 place-items-center rounded-full border border-slate-200 bg-white text-primary">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <div className="pt-1">
                    <h2 className="font-semibold text-[#142b45]">
                      {index + 1}. {step.title}
                    </h2>
                    <p className="mt-1 text-sm leading-6 text-slate-600">
                      {step.description}
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
          className="border border-slate-200 bg-white shadow-[0_18px_55px_rgba(20,43,69,0.08)]"
        >
          <header className="border-b border-slate-200 px-5 py-5 sm:px-8 sm:py-7">
            <div className="flex items-start gap-4">
              <span className="grid size-11 shrink-0 place-items-center rounded-md bg-blue-50 text-primary">
                <FormIcon className="size-5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-semibold text-primary">
                  {page.formEyebrow}
                </p>
                <h2
                  id="form-heading"
                  className="mt-1 text-2xl font-semibold tracking-tight text-[#142b45] sm:text-3xl"
                >
                  {page.formTitle}
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {page.formDescription}
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
