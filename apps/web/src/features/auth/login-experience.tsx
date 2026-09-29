"use client";

import { Building2, UserRound } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { PortalBrand } from "@/components/layout/site-header";
import { LanguageSelector } from "@/components/layout/language-selector";
import { ThemeToggle } from "@/components/theme-toggle";
import { LoginForm } from "@/features/auth/login-form";
import { useLanguage } from "@/components/providers/language-provider";

export type LoginMode = "applicant" | "inspector";

const workspaceContent = {
  applicant: {
    eyebrow: "Applicant Access",
    title: "Continue Your Approval Journey",
    description:
      "Sign in to manage your industrial project, documents and approval applications.",
    label: "Applicant",
    icon: UserRound,
    note: "For registered businesses and project applicants.",
  },
  inspector: {
    eyebrow: "Inspector Access",
    title: "Review Applications",
    description:
      "Sign in with your authorised inspector account to review applications assigned to your department.",
    label: "Inspector",
    icon: Building2,
    note: "Inspector accounts are issued and managed by departments.",
  },
} as const;

const workspaceLinks: Array<{ mode: LoginMode; href: string; label: string }> =
  [
    { mode: "applicant", href: "/auth/login", label: "Applicant" },
    { mode: "inspector", href: "/inspector/login", label: "Inspector" },
  ];

function Brand({ tone = "light" }: { tone?: "dark" | "light" }) {
  return (
    <Link
      href="/"
      className={`inline-flex min-h-11 items-center gap-3 rounded-sm focus-visible:outline-3 focus-visible:outline-offset-4 ${tone === "light" ? "focus-visible:outline-white" : "focus-visible:outline-[#315f9f]"}`}
      translate="no"
    >
      <PortalBrand tone={tone} />
    </Link>
  );
}

export function LoginExperience({ mode }: { mode: LoginMode }) {
  const { t, text } = useLanguage();
  const content = workspaceContent[mode];
  const Icon = content.icon;

  return (
    <div className="min-h-dvh overflow-x-hidden bg-muted text-foreground lg:grid lg:h-dvh lg:min-h-0 lg:grid-cols-[minmax(0,1.45fr)_minmax(34rem,0.9fr)] lg:overflow-hidden">
      <a
        href="#login-content"
        className="sr-only z-50 bg-card px-4 py-3 font-semibold text-foreground focus:fixed focus:top-4 focus:left-4 focus:not-sr-only"
      >
        {t("auth.signIn")}
      </a>
      <aside
        className="relative hidden bg-[#102849] lg:flex lg:h-dvh lg:min-h-0 lg:flex-col"
        aria-label={text("About UdyogSetu")}
      >
        <div className="relative min-h-[34rem] flex-1 overflow-hidden">
          <Image
            src="/images/steel-plant-campus.png"
            alt={text("Modern integrated steel manufacturing campus at dusk")}
            fill
            priority
            sizes="(min-width: 1024px) 64vw, 0px"
            className="object-cover object-center"
          />
          <div
            className="absolute inset-0 bg-[linear-gradient(90deg,rgba(7,24,49,0.9)_0%,rgba(7,24,49,0.62)_48%,rgba(7,24,49,0.2)_100%)]"
            aria-hidden="true"
          />
          <div className="absolute inset-x-0 top-0 flex h-16 items-center justify-between px-10 xl:px-14">
            <Brand tone="light" />
            <div className="flex items-center gap-3 text-white/70">
              <span
                className="grid size-9 place-items-center border border-white/30 text-xs font-bold text-white"
                aria-hidden="true"
              >
                MH
              </span>
              <div className="text-sm leading-5">
                <p className="font-semibold text-white">
                  {text("Single-Window Clearance")}
                </p>
                <p>{text("Maharashtra industrial approvals")}</p>
              </div>
            </div>
          </div>
          <div className="absolute top-20 right-6 flex flex-col items-center gap-1.5 xl:top-24 xl:right-8">
            <Image
              src="/images/emblem-india.svg"
              alt={text("National Emblem of India")}
              width={146}
              height={232}
              className="h-[70px] w-auto brightness-0 invert xl:h-20"
            />
            <p className="text-[9px] font-semibold tracking-[0.12em] text-white/90 uppercase">
              {text("Government of Maharashtra")}
            </p>
          </div>
          <div className="absolute inset-0 flex flex-col justify-center p-10 text-white xl:p-14">
            <p className="text-sm font-semibold tracking-wide text-[#efd383]">
              {text("Industrial Approvals, Connected")}
            </p>
            <h2 className="mt-4 max-w-3xl text-pretty text-5xl leading-[1.05] font-semibold tracking-[-0.04em] xl:text-6xl">
              {text("Move Your Industrial Project From Plan to Approval")}
            </h2>
            <p className="mt-5 max-w-2xl text-pretty text-base leading-7 text-slate-100 xl:text-lg">
              {text(
                "Manage submissions, respond to inspections and follow every departmental decision through one secure service.",
              )}
            </p>
          </div>
          <div className="absolute inset-x-0 bottom-0 flex min-h-16 items-center justify-between gap-6 px-10 text-xs font-semibold text-white/60 xl:px-14">
            <span>{text("Transparent, time-bound industrial approvals")}</span>
            <span>{text("Maharashtra industrial approval portal")}</span>
          </div>
        </div>
      </aside>

      <main
        id="login-content"
        className="flex min-h-dvh flex-col bg-muted lg:h-dvh lg:min-h-0 lg:overflow-y-auto"
      >
        <header className="flex min-h-14 items-center justify-between gap-2 border-b border-border bg-muted px-4 sm:gap-4 sm:px-8 lg:h-16 lg:justify-end lg:px-12">
          <div className="lg:hidden">
            <Brand tone="dark" />
          </div>
          <LanguageSelector />
          <ThemeToggle />
          <Link
            href="/"
            className="inline-flex min-h-11 shrink-0 items-center rounded-sm px-1 text-sm font-semibold whitespace-nowrap text-primary underline-offset-4 hover:underline focus-visible:outline-3 focus-visible:outline-[#315f9f] sm:px-2 sm:text-base"
          >
            {t("auth.portalHome")}
          </Link>
        </header>
        <div className="flex flex-1 items-start px-5 pt-4 pb-6 sm:px-8 sm:pt-5 sm:pb-8 lg:px-12 xl:px-20">
          <div className="mx-auto w-full max-w-xl">
            <p className="text-base font-bold tracking-wide text-primary">
              {text(content.eyebrow)}
            </p>
            <h1 className="mt-2 text-pretty text-4xl leading-tight font-semibold tracking-[-0.035em] text-[#122a4c] sm:text-5xl">
              {text(content.title)}
            </h1>
            <p className="mt-3 max-w-lg text-pretty text-base leading-7 text-[#58657a]">
              {text(content.description)}
            </p>
            <nav
              aria-label={text("Choose a sign-in workspace")}
              className="mt-5 grid grid-cols-2 gap-1 rounded-md border border-border bg-[#e9e9e7] p-1.5 shadow-sm"
            >
              {workspaceLinks.map((workspace) => (
                <Link
                  key={workspace.mode}
                  href={workspace.href}
                  aria-current={workspace.mode === mode ? "page" : undefined}
                  className="flex min-h-13 items-center justify-center rounded-sm border border-transparent px-2 text-base font-semibold text-[#4c586b] transition-[background-color,border-color,color,box-shadow] hover:border-[#c4cbd5] hover:bg-card hover:text-foreground focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#315f9f] aria-[current=page]:border-[#214d90] aria-[current=page]:bg-[#315f9f] aria-[current=page]:text-white aria-[current=page]:shadow-[0_4px_10px_rgba(49,95,159,0.24)]"
                >
                  {text(workspace.label)}
                </Link>
              ))}
            </nav>
            <section
              className="mt-3 flex items-center gap-3 border border-border bg-[#f2f4f6] px-4 py-3"
              aria-label={`${text(content.label)} ${t("nav.workspace")}`}
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-card text-primary shadow-sm">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <h2 className="font-semibold text-foreground">
                  {text(`${content.label} Workspace`)}
                </h2>
                <p className="text-sm leading-5 text-[#5c6778]">
                  {text(content.note)}
                </p>
              </div>
            </section>
            <div className="mt-4">
              <LoginForm mode={mode} />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
