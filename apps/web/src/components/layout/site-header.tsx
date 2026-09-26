"use client";

import Image from "next/image";
import Link from "next/link";
import { LanguageSelector } from "@/components/layout/language-selector";
import { useLanguage } from "@/components/providers/language-provider";

export function PortalBrand({ tone = "dark" }: { tone?: "dark" | "light" }) {
  const light = tone === "light";

  return (
    <span
      className={`inline-flex items-center gap-3 ${light ? "text-white" : "text-[#17345a]"}`}
      translate="no"
    >
      <Image
        src="/images/udyogsetu-emblem.svg"
        alt=""
        width={64}
        height={64}
        aria-hidden="true"
        className={`shrink-0 ${light ? "brightness-110" : ""}`}
      />
      <span className="text-2xl font-bold tracking-tight sm:text-3xl">
        UdyogSetu
      </span>
    </span>
  );
}

export function SiteHeader({ actionLabel = "Return home", actionHref = "/" }) {
  const { t } = useLanguage();
  return (
    <header className="border-b border-white/10 bg-[#142b45] text-white">
      <div className="mx-auto flex min-h-20 w-full max-w-7xl items-center justify-between gap-6 px-5 py-4 sm:px-8 lg:px-10">
        <Link
          href="/"
          className="rounded-sm focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-white"
        >
          <PortalBrand tone="light" />
          <span className="block text-sm font-medium text-slate-200 sm:text-base">
            {t("header.portal")}
          </span>
        </Link>
        <div className="flex items-center gap-3">
        <LanguageSelector />
        <Link
          href={actionHref}
          className="min-h-11 rounded-sm px-2 py-3 text-sm font-medium underline underline-offset-4 hover:text-slate-200 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-white sm:text-base"
        >
          {actionLabel === "Return home" ? t("header.returnHome") : actionLabel === "Change workspace" ? t("header.changeWorkspace") : actionLabel}
        </Link>
        </div>
      </div>
    </header>
  );
}
