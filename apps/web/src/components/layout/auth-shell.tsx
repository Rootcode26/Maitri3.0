"use client";

import { Check } from "lucide-react";
import type { ReactNode } from "react";

import { SiteHeader } from "@/components/layout/site-header";
import { useLanguage } from "@/components/providers/language-provider";

export function AuthShell({ children }: { children: ReactNode }) {
  const { t } = useLanguage();
  const benefits = [t("auth.reuseDocuments"), t("auth.trackApplications"), t("auth.respondRequests")];
  return (
    <div className="min-h-svh bg-background">
      <SiteHeader actionLabel="Change workspace" />
      <main
        id="main-content"
        className="mx-auto grid w-full max-w-6xl gap-10 px-5 py-10 sm:px-8 md:py-16 lg:grid-cols-[0.8fr_1.2fr] lg:items-center lg:gap-16 lg:px-10"
      >
        <section className="max-w-md" aria-labelledby="journey-heading">
          <p className="mb-3 text-sm font-semibold text-primary">{t("auth.applicantServices")}</p>
          <h1
            id="journey-heading"
            className="max-w-sm text-3xl leading-tight font-semibold tracking-tight text-foreground sm:text-4xl"
          >
            {t("auth.journey")}
          </h1>
          <ul className="mt-7 space-y-4 text-sm text-muted-foreground sm:text-base">
            {benefits.map((benefit) => (
              <li key={benefit} className="flex items-start gap-3">
                <Check
                  className="mt-0.5 size-5 shrink-0 text-emerald-600"
                  aria-hidden="true"
                />
                <span>{benefit}</span>
              </li>
            ))}
          </ul>
        </section>
        <div className="w-full">{children}</div>
      </main>
    </div>
  );
}
